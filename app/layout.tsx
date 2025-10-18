import type { Metadata } from "next";
import Providers from "./providers";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "Coral Attestation POC",
  description: "Delegated EAS attestation demo"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main style={{ margin: "2rem auto", maxWidth: 720, padding: 16 }}>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
