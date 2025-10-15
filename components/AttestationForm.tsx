"use client";

import { useMemo, useState } from "react";
import { z } from "zod";
import { attestationSchema } from "@/lib/validation";
import { buildDelegatedAttestTypedData } from "@/lib/eas";
import { useAccount, useSignTypedData } from "wagmi";
import { env } from "@/lib/env";

const formSchema = attestationSchema;

export function AttestationForm() {
  const { address, isConnected } = useAccount();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<null | { txHash?: string; error?: string }>(null);
  const [errors, setErrors] = useState<string | null>(null);

  const [values, setValues] = useState({
    schemaUid: env.defaultSchemaUid,
    recipient: "",
    dataHex: "0x",
    nonce: String(Date.now()),
    deadline: Math.floor(Date.now() / 1000) + 60 * 10
  });

  const { signTypedDataAsync } = useSignTypedData();

  const canSubmit = useMemo(() => isConnected && !!values.recipient && !!values.schemaUid, [isConnected, values]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors(null);
    setResult(null);
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(parsed.error.issues.map((i) => i.message).join("; "));
      return;
    }
    try {
      setSubmitting(true);
      const typedData = buildDelegatedAttestTypedData({
        schemaUid: parsed.data.schemaUid as `0x${string}`,
        recipient: parsed.data.recipient as `0x${string}`,
        dataHex: parsed.data.dataHex as `0x${string}`,
        deadline: parsed.data.deadline,
        nonce: parsed.data.nonce
      });

      const signature = await signTypedDataAsync({
        domain: typedData.domain as any,
        types: typedData.types as any,
        primaryType: typedData.primaryType as any,
        message: typedData.message as any
      });

      const payload = {
        schemaUid: parsed.data.schemaUid,
        recipient: parsed.data.recipient,
        dataHex: parsed.data.dataHex,
        attester: address,
        nonce: parsed.data.nonce,
        deadline: parsed.data.deadline,
        typedData,
        signature
      };

      const res = await fetch("/api/relay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Relay failed (${res.status})`);
      setResult({ txHash: json.txHash });
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
        Data (hex)
        <input
          value={values.dataHex}
          onChange={(e) => update("dataHex", e.target.value)}
          placeholder="0x…"
          required
          style={{ width: "100%" }}
        />
      </label>
      <label>
        Nonce
        <input value={values.nonce} onChange={(e) => update("nonce", e.target.value)} style={{ width: "100%" }} />
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
      {result?.error && <div style={{ color: "#b00" }}>{result.error}</div>}
    </form>
  );
}

