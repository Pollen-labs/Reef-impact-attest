import { WalletConnect } from "@/components/WalletConnect";
import { AttestationForm } from "@/components/AttestationForm";

export default function Page() {
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <h1>Attest</h1>
      <WalletConnect />
      <section>
        <h2>Create Delegated Attestation</h2>
        <AttestationForm />
      </section>
    </div>
  );
}

