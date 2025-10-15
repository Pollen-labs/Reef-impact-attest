// Supabase Edge Function: relay-attest
// Verifies EIP-712 delegated attestation, prevents replay, relays to EAS, logs to DB.

// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "@supabase/supabase-js";
import {
  createWalletClient,
  http,
  verifyTypedData,
  getAddress,
  isAddress,
  parseAbi,
} from "viem";
import { defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

// Environment
const RELAYER_PRIVATE_KEY = Deno.env.get("RELAYER_PRIVATE_KEY") || "";
const RPC_URL = Deno.env.get("RPC_URL") || "";
const EAS_ADDRESS = (Deno.env.get("EAS_ADDRESS") || "") as `0x${string}`;
const CHAIN_ID = Number(Deno.env.get("CHAIN_ID") || "0");
const EAS_DOMAIN_VERSION = Deno.env.get("EAS_DOMAIN_VERSION") || "0.26";
const ALLOWED_SCHEMA_UIDS = (Deno.env.get("ALLOWED_SCHEMA_UIDS") || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") || "*").split(",").map((s) => s.trim());
const DEFAULT_SCHEMA_UID = (Deno.env.get("DEFAULT_SCHEMA_UID") || "0x001e1e0d831d5ddf74723ac311f51e65dbdccec850e0f1fcf9ee41e6461e2d4d") as `0x${string}`;

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

// Minimal EAS ABI for attestByDelegation (includes deadline within signature struct)
const EAS_ABI = parseAbi([
  "function attestByDelegation((bytes32 schema,(address recipient,uint64 expirationTime,bool revocable,bytes32 refUID,bytes data,uint256 value) data,(uint8 v,bytes32 r,bytes32 s,uint64 deadline) signature,address attester) delegatedRequest) payable returns (bytes32)",
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
  return { wallet: w, account: acct };
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
  const v = parseInt(sv.slice(64, 66), 16);
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
    return json({ ok: true, chainId: CHAIN_ID, eas: EAS_ADDRESS, allowedSchemas: ALLOWED_SCHEMA_UIDS.length, walletReady }, { origin });
  }

  if (method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders(origin) });
  }

  try {
    const { wallet, account } = getWalletStrict();
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
    } = body as {
      schemaUid?: `0x${string}`;
      schemaUID?: `0x${string}`;
      recipient: `0x${string}`;
      dataHex: `0x${string}`;
      attester: `0x${string}`;
      nonce: string | number;
      deadline: number;
      typedData: TypedData;
      signature: `0x${string}`;
    };

    // Accept schemaUid/schemaUID and fallback to DEFAULT_SCHEMA_UID for dev
    const schemaUid = (_schemaUid || (body as any).schemaUID || DEFAULT_SCHEMA_UID) as `0x${string}`;

    // Basic validation
    if (!/^0x[0-9a-fA-F]{64}$/.test(schemaUid)) throw new Error("Invalid schemaUid");
    if (!isAddress(recipient)) throw new Error("Invalid recipient");
    if (!/^0x[0-9a-fA-F]*$/.test(dataHex)) throw new Error("Invalid dataHex");
    if (!isAddress(attester)) throw new Error("Invalid attester");
    if (!typedData?.domain || !typedData?.types || !typedData?.message) throw new Error("Invalid typedData");
    if (typeof deadline !== "number") throw new Error("Invalid deadline");

    // Guard: allowed schemas
    if (ALLOWED_SCHEMA_UIDS.length && !ALLOWED_SCHEMA_UIDS.includes(schemaUid)) {
      return json({ error: "Schema not allowed" }, { status: 403, origin });
    }

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
        { name: "deadline", type: "uint64" },
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
      version: EAS_DOMAIN_VERSION,
      chainId: CHAIN_ID,
      verifyingContract: EAS_ADDRESS,
    } as const;
    const canonicalMessage = {
      schema: schemaUid,
      data: {
        recipient,
        expirationTime: Number(dataMsg.expirationTime ?? 0),
        revocable: Boolean(dataMsg.revocable ?? true),
        refUID: (dataMsg.refUID || `0x${"0".repeat(64)}`) as `0x${string}`,
        data: dataHex,
        value: Number(dataMsg.value ?? 0),
      },
      nonce: Number((msg?.nonce ?? 0) as number),
      deadline: Number((msg?.deadline ?? deadline) as number),
    } as const;

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
        data_hex: dataHex,
        deadline: new Date(deadline * 1000).toISOString(),
        status: "pending",
      })
      .select("id")
      .single();
    if (attIns.error) throw attIns.error;

    // Build delegated request args for EAS (reuse msg/dataMsg from verification)
    const { r, s, v } = splitSignature(signature);

    // Send transaction
    const hash = await wallet.writeContract({
      address: EAS_ADDRESS,
      abi: EAS_ABI,
      functionName: "attestByDelegation",
      args: [
        {
          schema: schemaUid,
          data: {
            recipient,
            expirationTime: BigInt(dataMsg.expirationTime ?? 0),
            revocable: Boolean(dataMsg.revocable ?? true),
            refUID: (dataMsg.refUID || `0x${"0".repeat(64)}`) as `0x${string}`,
            data: dataHex,
            value: BigInt(dataMsg.value ?? 0n),
          },
          signature: { v, r, s, deadline: BigInt((msg?.deadline ?? deadline) as number) },
          attester,
        },
      ],
      value: BigInt(dataMsg.value ?? 0n),
    });

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
    // Best-effort: log failure if we created a pending row is complex to identify; skipping linkage here.
    return json({ error: msg }, { status: 400, origin });
  }
});
