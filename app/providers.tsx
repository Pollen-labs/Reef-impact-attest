"use client";

import { WagmiProvider, createConfig, http, injected } from "wagmi";
import { sepolia } from "viem/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode, useState } from "react";

const config = createConfig({
  chains: [sepolia],
  transports: {
    [sepolia.id]: http()
  },
  connectors: [
    injected({
      target: "metaMask",
      unstable_shimAsyncInject: true,
      shimDisconnect: true
    })
  ]
});

export default function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
