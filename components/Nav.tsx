"use client";

import Link from "next/link";
import type { Route } from "next";
import { useAccount, useDisconnect } from "wagmi";
import { useEffect, useState } from "react";

export function Nav() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isConnected || !address) {
        setHandle(null);
        return;
      }
      try {
        const res = await fetch(`/api/profiles/by-wallet?address=${address}`);
        const json = await res.json().catch(() => ({}));
        if (!cancelled) setHandle(json?.handle || null);
      } catch {
        if (!cancelled) setHandle(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address, isConnected]);

  const profileLabel = isConnected ? "Profile" : "Connect";
  const profileHref = isConnected ? (handle ? `/profile/${handle}` : "/attest") : "/connect";

  return (
    <nav style={{ display: "flex", gap: 12, padding: "8px 16px", borderBottom: "1px solid #eee", alignItems: "center" }}>
      <div style={{ display: "flex", gap: 12, flex: 1 }}>
        <Link href="/">Home</Link>
        <Link href="/attest">Attest</Link>
        <Link href="/map">Map</Link>
      <Link href={profileHref as Route}>{profileLabel}</Link>
      </div>
      {isConnected && (
        <button onClick={() => disconnect()} style={{ marginLeft: "auto" }}>
          Logout
        </button>
      )}
    </nav>
  );
}
