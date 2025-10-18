"use client";

import { useAccount } from "wagmi";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  walletAddress: string;
  orgName: string;
  website: string | null;
  description: string | null;
};

export function ProfileEditor({ walletAddress, orgName, website, description }: Props) {
  const { address, isConnected } = useAccount();
  const router = useRouter();
  const canEdit = useMemo(() => {
    if (!isConnected || !address) return false;
    return address.toLowerCase() === walletAddress.toLowerCase();
  }, [address, isConnected, walletAddress]);

  const [values, setValues] = useState({
    org_name: orgName || "",
    website: website || "",
    description: description || "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setValues({
      org_name: orgName || "",
      website: website || "",
      description: description || "",
    });
  }, [orgName, website, description]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profiles/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet_address: walletAddress,
          org_name: values.org_name,
          website: values.website || null,
          description: values.description || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Save failed (${res.status})`);
      setMessage("Saved");
      router.refresh();
    } catch (err: any) {
      setMessage(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) return null;

  return (
    <form onSubmit={onSave} style={{ display: "grid", gap: 12, border: "1px solid #eee", padding: 12 }}>
      <h3>Edit Profile</h3>
      <label>
        Organization Name
        <input
          value={values.org_name}
          onChange={(e) => setValues((s) => ({ ...s, org_name: e.target.value }))}
          placeholder="Organization or researcher name"
          required
          style={{ width: "100%" }}
        />
      </label>
      <label>
        Website
        <input
          value={values.website}
          onChange={(e) => setValues((s) => ({ ...s, website: e.target.value }))}
          placeholder="https://example.org"
          style={{ width: "100%" }}
        />
      </label>
      <label>
        Description
        <textarea
          value={values.description}
          onChange={(e) => setValues((s) => ({ ...s, description: e.target.value }))}
          rows={3}
          placeholder="Brief description"
          style={{ width: "100%" }}
        />
      </label>
      <button type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
      {message && <div>{message}</div>}
    </form>
  );
}

