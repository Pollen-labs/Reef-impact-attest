// Ambient type for injected EIP-1193 providers (e.g., MetaMask)
// Installable alternative: `pnpm add -D @metamask/providers` and use its types.
import type { Eip1193Provider } from "ethers";

declare global {
  interface Window {
    ethereum?: Eip1193Provider & {
      isMetaMask?: boolean;
      providers?: Eip1193Provider[];
    };
  }
}

export {};

