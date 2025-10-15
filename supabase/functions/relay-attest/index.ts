// Supabase Edge Function: relay-attest
// Verifies EIP-712 delegated attestation, prevents replay, relays to EAS, logs to DB.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import {
  createWalletClient,
  createPublicClient,
  http,
  verifyTypedData,
  recoverTypedDataAddress,
  getAddress,
  isAddress,
  parseAbi,
  defineChain,
} from "npm:viem@2.18.8";
import { privateKeyToAccount } from "npm:viem@2.18.8/accounts";
import { EAS, SchemaEncoder, NO_EXPIRATION, ZERO_BYTES32 } from "npm:@ethereum-attestation-service/eas-sdk@2.4.0";
import { ethers } from "npm:ethers@6.13.2";

// Environment
const RELAYER_PRIVATE_KEY = Deno.env.get("RELAYER_PRIVATE_KEY") || "";
const RPC_URL = Deno.env.get("RPC_URL") || "";
const EAS_ADDRESS = (Deno.env.get("EAS_ADDRESS") || "") as `0x${string}`;
const CHAIN_ID = Number(Deno.env.get("CHAIN_ID") || "0");
const EAS_DOMAIN_VERSION = Deno.env.get("EAS_DOMAIN_VERSION") || "0.26";
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map((s) => s.trim());
// POC: Single schema UID (Sepolia)
const SCHEMA_UID = "0x001e1e0d831d5ddf74723ac311f51e65dbdccec850e0f1fcf9ee41e6461e2d4d" as const;

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = ALLOWED_ORIGINS.includes("*") || (origin && ALLOWED_ORIGINS.includes(origin));
  return {
    "access-control-allow-origin": allowed ? origin ?? "*" : ALLOWED_ORIGINS[0] ?? "*",
    "access-control-allow-methods": "POST,OPTIONS,GET",
    "access-control-allow-headers": "authorization, x-client-info, apikey, content-type",
  };
}

function json(data: unknown, init: ResponseInit & { origin?: string | null } = {}) {
  const baseHeaders = corsHeaders(init.origin ?? null);
  const headers = new Headers({ "content-type": "application/json; charset=utf-8", ...baseHeaders, ...(init.headers || {}) });
  const { origin: _omit, ...rest } = init as any;
  return new Response(JSON.stringify(data), { ...rest, headers });
}

// Minimal EAS ABIs (match Sepolia: uint256 deadline)
// V1: packs everything into a single struct with deadline inside signature (uint256)
const EAS_ABI_V1 = parseAbi([
  "function attestByDelegation((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data,(uint8 v,bytes32 r,bytes32 s,uint256 deadline) signature,address attester) delegatedRequest) payable returns (bytes32)",
]);
// V2 (Sepolia): separate args and top-level deadline (uint256)
const EAS_ABI_V2 = parseAbi([
  "function attestByDelegation(bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data,(uint8 v,bytes32 r,bytes32 s) signature,address attester,uint256 deadline) payable returns (bytes32)",
]);
// Common: read on-chain nonce for delegated attestations
const EAS_READ_ABI = parseAbi([
  "function getNonce(address account) view returns (uint256)",
]);

const chain = defineChain({
  id: CHAIN_ID,
  name: `chain-${CHAIN_ID}`,
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] }, public: { http: [RPC_URL] } },
});

function normalizePrivateKey(input: string): `0x${string}` {
  const raw = (input || "").trim();
  if (!raw) throw new Error("RELAYER_PRIVATE_KEY missing");
  const hex = raw.startsWith("0x") ? raw : (`0x${raw}` as const);
  if (!/^0x[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error("RELAYER_PRIVATE_KEY must be 32-byte hex (0x + 64 chars)");
  }
  return hex as `0x${string}`;
}

function getWalletStrict() {
  const pk = normalizePrivateKey(RELAYER_PRIVATE_KEY);
  const acct = privateKeyToAccount(pk);
  const w = createWalletClient({ account: acct, chain, transport: http(RPC_URL) });
  const pub = createPublicClient({ chain, transport: http(RPC_URL) });
  return { wallet: w, publicClient: pub, account: acct };
}

function getEthersSigner() {
  const pk = normalizePrivateKey(RELAYER_PRIVATE_KEY);
  const provider = new ethers.JsonRpcProvider(RPC_URL, undefined, { staticNetwork: true });
  const signer = new ethers.Wallet(pk, provider);
  return signer;
}

type TypedData = {
  domain: any;
  types: Record<string, any>;
  primaryType: string;
  message: any;
};

function splitSignature(sig: `0x${string}`) {
  // 0x + 65 bytes => 132 hex chars
  const s = sig.slice(2);
  const r = `0x${s.slice(0, 64)}` as `0x${string}`;
  const sv = s.slice(64);
  const sPart = `0x${sv.slice(0, 64)}` as `0x${string}`;
  let v = parseInt(sv.slice(64, 66), 16);
  // Normalize v for EIP-712 message signatures
  if (v === 0 || v === 1) v += 27; // 0/1 -> 27/28
  if (v !== 27 && v !== 28) {
    throw new Error(`Invalid v in signature: ${v}`);
  }
  return { r, s: sPart, v } as const;
}

function nowSec() {
  return Math.floor(Date.now() / 1000);
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response("", { headers: corsHeaders(origin) });
  }

  if (method === "GET") {
    let walletReady = false;
    try {
      normalizePrivateKey(RELAYER_PRIVATE_KEY);
      walletReady = Boolean(RPC_URL && EAS_ADDRESS && CHAIN_ID);
    } catch (_) {
      walletReady = false;
    }
    return json({ ok: true, chainId: CHAIN_ID, eas: EAS_ADDRESS, schema: SCHEMA_UID, walletReady }, { origin });
  }

  if (method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders(origin) });
  }

  try {
    const { wallet, publicClient, account } = getWalletStrict();
    if (!RPC_URL || !EAS_ADDRESS || !CHAIN_ID) throw new Error("Missing RPC_URL/EAS_ADDRESS/CHAIN_ID envs");

    const body = await req.json();
    const {
      schemaUid: _schemaUid,
      recipient,
      dataHex,
      attester,
      nonce,
      deadline,
      typedData,
      signature,
      user,
    } = body as {
      schemaUid?: `0x${string}`;
      schemaUID?: `0x${string}`;
      recipient: `0x${string}`;
      dataHex?: `0x${string}`;
      attester: `0x${string}`;
      nonce: string | number;
      deadline: number;
      typedData: TypedData;
      signature: `0x${string}`;
      user?: string;
    };

    // POC: Enforce a single schema UID (Sepolia)
    const schemaUid = SCHEMA_UID as `0x${string}`;

    // Debug logs to diagnose 400s
    try {
      console.log("MSG.recipient", (body?.typedData?.message?.data?.recipient ?? body?.typedData?.message?.recipient));
      console.log("TYPEDDATA", JSON.stringify(body?.typedData));
      console.log("NOW/DEADLINE", Math.floor(Date.now() / 1000), body?.deadline);
    } catch (_) {
      // ignore log errors
    }

    // Basic validation
    if (!/^0x[0-9a-fA-F]{64}$/.test(schemaUid)) throw new Error("Invalid schemaUid");
    if (!isAddress(recipient)) {
      console.log("BAD_ADDRESS.recipient", recipient);
      return json({ error: "BAD_ADDRESS", details: recipient }, { status: 400, origin });
    }
    // POC: encode dataHex from a simple string if needed
    let finalDataHex = dataHex as `0x${string}` | undefined;
    const isHex = (v: unknown) => typeof v === "string" && /^0x[0-9a-fA-F]*$/.test(v);
    if (!isHex(finalDataHex)) {
      if (typeof user === "string") {
        const encoder = new SchemaEncoder("string user");
        finalDataHex = encoder.encodeData([{ name: "user", type: "string", value: user }]) as `0x${string}`;
        console.log("ENCODED_DATA_HEX_FROM_USER", user, finalDataHex);
      } else {
        throw new Error("Invalid dataHex and no 'user' provided to encode");
      }
    }
    if (!isAddress(attester)) throw new Error("Invalid attester");
    if (!typedData?.domain || !typedData?.types || !typedData?.message) throw new Error("Invalid typedData");
    if (typeof deadline !== "number") throw new Error("Invalid deadline");

    // If typedData.message contains a non-hex recipient, surface a BAD_ADDRESS early for clarity
    const typedRecipient: string | undefined = (typedData?.message?.data?.recipient ?? typedData?.message?.recipient);
    if (typedRecipient && !isAddress(typedRecipient as string)) {
      console.log("BAD_ADDRESS.typedData.message.recipient", typedRecipient);
      return json({ error: "BAD_ADDRESS", details: typedRecipient }, { status: 400, origin });
    }

    // POC: Only one schema is allowed; no dynamic allowlist

    // Guard: typed data domain matches backend expectations
    const domain = typedData.domain;
    if (Number(domain?.chainId) !== CHAIN_ID) throw new Error("Domain chainId mismatch");
    if ((domain?.verifyingContract as string)?.toLowerCase() !== EAS_ADDRESS.toLowerCase()) {
      throw new Error("Domain verifyingContract mismatch");
    }

    // Guard: deadline not expired
    if (deadline <= nowSec()) throw new Error("Signature deadline expired");

    // Verify signature against canonical EAS types (do not trust client-provided types)
    const canonicalTypes = {
      Attest: [
        { name: "schema", type: "bytes32" },
        { name: "data", type: "AttestationRequestData" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
      AttestationRequestData: [
        { name: "recipient", type: "address" },
        { name: "expirationTime", type: "uint64" },
        { name: "revocable", type: "bool" },
        { name: "refUID", type: "bytes32" },
        { name: "data", type: "bytes" },
        { name: "value", type: "uint256" },
      ],
    } as const;

    const msg = typedData.message as any;
    const dataMsg = (msg?.data || {}) as any;
    const canonicalDomain = {
      name: "EAS",
      // accept the exact version used by the client; still enforce chainId + verifyingContract
      version: (typedData?.domain?.version ?? EAS_DOMAIN_VERSION),
      chainId: CHAIN_ID,
      verifyingContract: EAS_ADDRESS,
    } as const;
    const canonicalMessage = {
      schema: schemaUid,
      data: {
        recipient,
        expirationTime: BigInt(dataMsg.expirationTime ?? 0),
        revocable: Boolean(dataMsg.revocable ?? true),
        refUID: (dataMsg.refUID || (ZERO_BYTES32 as `0x${string}`)) as `0x${string}`,
        data: finalDataHex!,
        value: BigInt(dataMsg.value ?? 0),
      },
      nonce: BigInt((msg?.nonce ?? 0) as number),
      deadline: BigInt((msg?.deadline ?? deadline) as number),
    } as const;

    // On-chain nonce check to catch stale nonce early
    try {
      const onchainNonce = (await publicClient.readContract({
        address: EAS_ADDRESS,
        abi: EAS_READ_ABI,
        functionName: "getNonce",
        args: [attester],
      })) as bigint;
      const signed = BigInt(String(msg?.nonce ?? 0));
      if (onchainNonce !== signed) {
        console.log("BAD_NONCE", { onchain: onchainNonce.toString(), signed: signed.toString() });
        return json({ error: "BAD_NONCE", expected: onchainNonce.toString(), got: signed.toString() }, { status: 400, origin });
      }
    } catch (e) {
      console.log("NONCE_CHECK_FAILED", String((e as any)?.message || e));
      // continue; do not hard fail on read errors
    }

    // Recover and log attester vs provided for debugging
    try {
      const recovered = await recoverTypedDataAddress({
        domain: canonicalDomain as any,
        types: canonicalTypes as any,
        primaryType: "Attest",
        message: canonicalMessage as any,
        signature,
      });
      console.log("RECOVERED", recovered, "ATTESTER", body?.attester);
    } catch (e) {
      console.log("RECOVERED.failed", String((e as any)?.message || e));
    }

    const verified = await verifyTypedData({
      address: getAddress(attester),
      domain: canonicalDomain as any,
      types: canonicalTypes as any,
      primaryType: "Attest",
      message: canonicalMessage as any,
      signature,
    });
    if (!verified) throw new Error("Invalid signature");

    // Ensure DB tracks the exact nonce used in the signed typedData
    const signedNonce = String((typedData?.message as any)?.nonce ?? nonce);
    try { console.log("NONCE", signedNonce); } catch (_) {}

    // Prevent replay at API layer by inserting nonce row (unique constraint)
    const nonceInsert = await supabase.from("nonces").insert({
      attester: attester.toLowerCase(),
      schema_uid: schemaUid,
      nonce: signedNonce,
      consumed: false,
    });
    if (nonceInsert.error) {
      if (nonceInsert.error.code === "23505") {
        // A row already exists for this (attester, schema_uid, nonce).
        // Allow retry if it has not been marked consumed yet (previous attempt failed before on-chain success).
        const existing = await supabase
          .from("nonces")
          .select("consumed")
          .eq("attester", attester.toLowerCase())
          .eq("schema_uid", schemaUid)
          .eq("nonce", signedNonce)
          .maybeSingle();
        if (existing.data && existing.data.consumed === false) {
          // proceed; do not block retries
        } else {
          return json({ error: "Nonce already used" }, { status: 409, origin });
        }
      } else {
        throw nonceInsert.error;
      }
    }

    // Create attestation log (pending)
    const attIns = await supabase
      .from("attestations")
      .insert({
        attester: attester.toLowerCase(),
        schema_uid: schemaUid,
        recipient: recipient.toLowerCase(),
        data_hex: finalDataHex!,
        deadline: new Date(deadline * 1000).toISOString(),
        status: "pending",
      })
      .select("id")
      .single();
    if (attIns.error) throw attIns.error;

    // Build delegated request args for EAS SDK
    const { r, s, v } = splitSignature(signature);
    const signer = getEthersSigner();
    const eas = new EAS(EAS_ADDRESS);
    eas.connect(signer);

    let hash: `0x${string}`;
    try {
      const tx = await eas.attestByDelegation({
        schema: schemaUid,
        data: {
          recipient,
          expirationTime: BigInt(dataMsg.expirationTime ?? 0) || (NO_EXPIRATION as bigint),
          revocable: Boolean(dataMsg.revocable ?? true),
          refUID: (dataMsg.refUID || (ZERO_BYTES32 as `0x${string}`)) as `0x${string}`,
          data: finalDataHex!,
          value: BigInt(dataMsg.value ?? 0),
        },
        signature: { v, r, s },
        attester,
        deadline: BigInt((msg?.deadline ?? deadline) as number),
      } as any);
      hash = tx.hash as `0x${string}`;
      console.log("EAS_SDK_WRITE", hash);
    } catch (e: any) {
      console.log("EAS_SDK_WRITE_FAILED", e?.reason || e?.shortMessage || String(e));
      throw new Error("EAS SDK write failed");
    }

    // Update DB: success
    await supabase
      .from("nonces")
      .update({ consumed: true })
      .eq("attester", attester.toLowerCase())
      .eq("schema_uid", schemaUid)
      .eq("nonce", signedNonce);
    await supabase
      .from("attestations")
      .update({ status: "success", tx_hash: hash })
      .eq("id", attIns.data.id);

    return json({ txHash: hash }, { origin });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : String(err);
    try { console.log("RELAY-ERROR", msg); } catch (_) {}
    // Best-effort: log failure if we created a pending row is complex to identify; skipping linkage here.
    return json({ error: msg }, { status: 400, origin });
  }
});
