"use client";

import { useEffect, useMemo } from "react";
import type { Route } from "next";
import { useAccount, useConnect, useConnectors } from "wagmi";
import { useRouter } from "next/navigation";

export default function ConnectPage() {
  const { isConnected, address } = useAccount();
  const router = useRouter();
  const { connect, isPending } = useConnect();
  const connectors = useConnectors();

  const injectedConnector = useMemo(() => connectors.find((c) => c.id === "metaMask" || c.id === "injected"), [connectors]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isConnected || !address) return;
      try {
        const res = await fetch(`/api/profiles/by-wallet?address=${address}`);
        const json = await res.json().catch(() => ({}));
        const handle = json?.handle as string | null;
        const href = (handle ? `/profile/${handle}` : "/attest") as Route;
        if (!cancelled) router.replace(href);
      } catch {
        if (!cancelled) router.replace("/attest" as Route);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isConnected, address, router]);

  const onConnect = () => {
    if (injectedConnector) connect({ connector: injectedConnector });
  };

  const hasProvider = typeof window !== "undefined" && (window as any).ethereum;

  if (isConnected) {
    return (
      <div style={{ padding: 24 }}>
        <p>Redirecting…</p>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 12, padding: 24 }}>
      <h1>Connect</h1>
      <p>Please connect with MetaMask to continue.</p>
      <button onClick={onConnect} disabled={isPending || !injectedConnector}>
        {isPending ? "Connecting…" : injectedConnector ? `Connect ${injectedConnector.name}` : "MetaMask not detected"}
      </button>
      {!hasProvider && (
        <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
          Install MetaMask
        </a>
      )}
    </div>
  );
}
