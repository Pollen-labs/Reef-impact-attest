"use client";

import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { attestationSchema } from "@/lib/validation";
import { useAccount, usePublicClient } from "wagmi";
import { env } from "@/lib/env";
import { EAS, SchemaEncoder, ZERO_BYTES32, NO_EXPIRATION } from "@ethereum-attestation-service/eas-sdk";
import { EAS_GET_NONCE_ABI } from "@/lib/eas";
import { ethers } from "ethers";

const formSchema = attestationSchema;

export function AttestationForm() {
  const { address, isConnected } = useAccount();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | { txHash?: string; uid?: string; error?: string }>(null);
  const [errors, setErrors] = useState<string | null>(null);

  const [values, setValues] = useState({
    schemaUid: env.defaultSchemaUid || "0x001e1e0d831d5ddf74723ac311f51e65dbdccec850e0f1fcf9ee41e6461e2d4d",
    recipient: "",
    dataHex: "0x",
    user: "",
    nonce: "",
    deadline: Math.floor(Date.now() / 1000) + 60 * 10
  });

  const publicClient = usePublicClient();

  const canSubmit = useMemo(() => isConnected && !!values.recipient && !!values.schemaUid, [isConnected, values]);

  // Auto-encode data for schema: "string user"
  useEffect(() => {
    try {
      const encoder = new SchemaEncoder("string user");
      const encoded = encoder.encodeData([
        { name: "user", type: "string", value: values.user }
      ]);
      setValues((s) => ({ ...s, dataHex: encoded }));
    } catch (e) {
      // keep previous dataHex on failure
    }
  }, [values.user]);

  // Prefill recipient with connected address if empty
  useEffect(() => {
    if (address && !values.recipient) {
      setValues((s) => ({ ...s, recipient: address }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Fetch and display current chain nonce for attester
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!publicClient || !address) return;
        const chainNonce = (await publicClient.readContract({
          address: env.easAddress as `0x${string}`,
          abi: EAS_GET_NONCE_ABI as any,
          functionName: "getNonce",
          args: [address]
        })) as unknown as bigint;
        if (!cancelled) setValues((s) => ({ ...s, nonce: String(chainNonce) }));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, address]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors(null);
    setResult(null);
    // Ensure recipient defaults to connected address if missing
    const candidate = { ...values, recipient: values.recipient || (address ?? "") };
    const parsed = formSchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message).join("; "));
      return;
    }
    try {
      setSubmitting(true);
      // Build EAS SDK objects from wallet (ethers provider)
      if (!window.ethereum) throw new Error("No injected wallet available");
      // BrowserProvider does not accept an options object; passing { staticNetwork: true }
      // as the second param triggers "invalid network object name or chainId".
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const attesterAddr = await signer.getAddress();

      const eas = new EAS(env.easAddress);
      eas.connect(signer as any);

      // Ensure on-chain nonce matches what we sign with
      const chainNonce = await eas.getNonce(attesterAddr);

      // Encode data for schema: string user (already computed in values.dataHex, but re-derive to be safe)
      const encoder = new SchemaEncoder("string user");
      const userStr = parsed.data.user ?? values.user;
      const dataHex = encoder.encodeData([{ name: "user", type: "string", value: userStr }]);

      // Compute a safe future deadline (>= now + 10 min)
      const nowSec = Math.floor(Date.now() / 1000);
      const desired = parsed.data.deadline || 0;
      const safeDeadlineSec = Math.max(desired, nowSec + 10 * 60);

      // Sign delegated attestation via SDK
      const delegated = await (await eas.getDelegated()).signDelegatedAttestation({
        schema: parsed.data.schemaUid as `0x${string}`,
        recipient: parsed.data.recipient as `0x${string}`,
        expirationTime: NO_EXPIRATION as unknown as bigint,
        revocable: true,
        refUID: ZERO_BYTES32 as `0x${string}`,
        data: dataHex as `0x${string}`,
        value: 0n,
        deadline: BigInt(safeDeadlineSec),
        nonce: chainNonce,
      }, signer as any);

      // Build a plain JSON-friendly payload that explicitly carries deadline/nonce as numbers/strings
      const delegatedPayload = {
        ...delegated,
        message: {
          ...delegated.message,
          deadline: BigInt(safeDeadlineSec),
          nonce: chainNonce,
        },
      } as any;

      const payload = {
        attester: attesterAddr as `0x${string}`,
        delegatedAttestation: delegatedPayload,
      };

      const res = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // JSON.stringify cannot serialize BigInt. Convert all bigint values to strings.
        body: JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v))
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Relay failed (${res.status})`);
      // Worker returns { uid }; edge function returned { txHash }
      setResult({ txHash: json.txHash, uid: json.uid });
    } catch (err: any) {
      setResult({ error: err?.message || String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  function update<K extends keyof typeof values>(key: K, v: string) {
    setValues((s) => ({ ...s, [key]: key === "deadline" ? Number(v) : v } as any));
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
      <label>
        Schema UID
        <input
          value={values.schemaUid}
          onChange={(e) => update("schemaUid", e.target.value)}
          placeholder="0x…"
          required
          style={{ width: "100%" }}
        />
      </label>
      <label>
        Recipient Address
        <input
          value={values.recipient}
          onChange={(e) => update("recipient", e.target.value)}
          placeholder="0x…"
          required
          style={{ width: "100%" }}
        />
      </label>
      <label>
        user (string)
        <input
          value={values.user}
          onChange={(e) => update("user", e.target.value)}
          placeholder="your name or id"
          style={{ width: "100%" }}
        />
      </label>
      <div>
        Encoded data (auto):
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", background: "#f6f6f6", padding: 8 }}>
          {values.dataHex}
        </pre>
      </div>
      <label>
        Nonce (auto from chain)
        <input value={values.nonce} readOnly style={{ width: "100%", background: "#f6f6f6" }} />
      </label>
      <label>
        Deadline (unix seconds)
        <input
          type="number"
          value={values.deadline}
          onChange={(e) => update("deadline", e.target.value)}
          style={{ width: "100%" }}
        />
      </label>
      <button type="submit" disabled={!canSubmit || submitting}>
        {submitting ? "Submitting…" : "Sign & Relay"}
      </button>
      {errors && <div style={{ color: "#b00" }}>{errors}</div>}
      {result?.txHash && (
        <div>
          Submitted. Tx Hash: {result.txHash}
          <div>
            <a
              href={`https://sepolia.easscan.org/tx/${result.txHash}`}
              target="_blank"
              rel="noreferrer"
            >
              View in EAS Explorer
            </a>
          </div>
        </div>
      )}
      {result?.uid && (
        <div>
          Attestation UID: {result.uid}
          <div>
            <a
              href={`https://sepolia.easscan.org/attestation/view/${result.uid}`}
              target="_blank"
              rel="noreferrer"
            >
              View Attestation
            </a>
          </div>
        </div>
      )}
      {result?.error && <div style={{ color: "#b00" }}>{result.error}</div>}
    </form>
  );
}
