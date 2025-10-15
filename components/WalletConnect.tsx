"use client";

import React from "react";
import { useAccount, useConnect, useDisconnect, useConnectors } from "wagmi";
import { injected } from "wagmi";

export function WalletConnect() {
  const { address, isConnected } = useAccount();
  const { connect, isPending, error: connectError } = useConnect();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();

  if (isConnected) {
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <span>Connected: {address}</span>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    );
  }

  const injectedConnector = connectors.find((c) => c.id === "metaMask" || c.id === "injected");
  const onConnect = () => {
    if (injectedConnector) connect({ connector: injectedConnector });
  };

  const hasProvider = typeof window !== "undefined" && (window as any).ethereum;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      <button onClick={onConnect} disabled={isPending || !injectedConnector}>
        {isPending ? "Connecting…" : injectedConnector ? `Connect ${injectedConnector.name}` : "No wallet found"}
      </button>
      {!hasProvider && (
        <a href="https://metamask.io/download/" target="_blank" rel="noreferrer">
          Install MetaMask
        </a>
      )}
      {connectError && <div style={{ color: "#b00" }}>{connectError.message}</div>}
    </div>
  );
}
