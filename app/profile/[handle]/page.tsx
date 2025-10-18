import { supabaseAdmin } from "@/lib/supabase-admin";
import { ProfileEditor } from "@/components/ProfileEditor";

export default async function Page({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const { data: profile, error: pErr } = await supabaseAdmin
    .from("profiles")
    .select("id, handle, org_name, website, description, wallet_address, created_at")
    .ilike("handle", handle)
    .maybeSingle();

  if (pErr) {
    return <div>Error loading profile: {pErr.message}</div>;
  }
  if (!profile) {
    return <div>Profile not found for handle: {handle}</div>;
  }

  const { data: attests } = await supabaseAdmin
    .from("attestations")
    .select("id, uid, created_at")
    .eq("profile_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <h1>@{profile.handle}</h1>
      <div>
        <div><strong>Organization</strong>: {profile.org_name}</div>
        {profile.website && (
          <div>
            <a href={profile.website} target="_blank" rel="noreferrer">{profile.website}</a>
          </div>
        )}
        {profile.description && <p>{profile.description}</p>}
      </div>
      <ProfileEditor
        walletAddress={profile.wallet_address}
        orgName={profile.org_name}
        website={profile.website}
        description={profile.description}
      />
      <section>
        <h2>Attestation History</h2>
        {!attests?.length && <div>No attestations yet.</div>}
        <ul style={{ padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
          {(attests || []).map((a) => (
            <li key={a.id} style={{ border: "1px solid #eee", padding: 12 }}>
              {a.uid ? (
                <a href={`https://optimism-sepolia.easscan.org/attestation/view/${a.uid}`} target="_blank" rel="noreferrer">
                  {a.uid}
                </a>
              ) : (
                <span>UID pending…</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
