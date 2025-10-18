import { supabaseAdmin } from "@/lib/supabase-admin";

export default async function Page({ params }: { params: { handle: string } }) {
  const handle = params.handle;
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
    .select("id, uid, regen_type, action_date, location_lat, location_lng, summary, created_at")
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
      <section>
        <h2>Attestations</h2>
        {!attests?.length && <div>No attestations yet.</div>}
        <ul style={{ padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
          {(attests || []).map((a) => (
            <li key={a.id} style={{ border: "1px solid #eee", padding: 12 }}>
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <span>{a.regen_type} • {a.action_date} • ({a.location_lat},{a.location_lng})</span>
                {a.uid && (
                  <a
                    href={`https://optimism-sepolia.easscan.org/attestation/view/${a.uid}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View on EAS
                  </a>
                )}
              </div>
              {a.summary && <div>{a.summary}</div>}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

