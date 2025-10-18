import Link from "next/link";

export function Nav() {
  return (
    <nav style={{ display: "flex", gap: 12, padding: "8px 16px", borderBottom: "1px solid #eee" }}>
      <Link href="/">Home</Link>
      <Link href="/attest">Attest</Link>
      <Link href="/map">Map</Link>
      <Link href="/profile/demo">Profile</Link>
    </nav>
  );
}

