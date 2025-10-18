import Link from "next/link";

export default function Page() {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1>Reef Impact — MVP</h1>
      <p>Welcome. Use the Attest page to submit new attestations, or view your Profile to see history.</p>
      <div>
        <Link href="/attest">Go to Attest →</Link>
      </div>
    </div>
  );
}
