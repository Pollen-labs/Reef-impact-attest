import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type AttRow = {
  uid: string | null;
  location_lat: number | string | null;
  location_lng: number | string | null;
  regen_type: string | null;
  profile_id: string;
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("attestations")
    .select("uid, location_lat, location_lng, regen_type, profile_id")
    .not("location_lat", "is", null)
    .not("location_lng", "is", null)
    .limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data || []) as AttRow[];
  const profileIds = Array.from(new Set(rows.map((r) => r.profile_id).filter(Boolean)));

  let profiles: Record<string, { handle: string; org_name: string | null }> = {};
  if (profileIds.length) {
    const { data: profs, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, handle, org_name")
      .in("id", profileIds);
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    for (const p of profs || []) {
      profiles[p.id as string] = { handle: p.handle as string, org_name: (p.org_name as string) || null };
    }
  }

  const features = rows
    .filter((r) => r.location_lat != null && r.location_lng != null)
    .map((r) => {
      const lat = Number(r.location_lat);
      const lng = Number(r.location_lng);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
      const prof = profiles[r.profile_id] || { handle: null, org_name: null } as any;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          uid: r.uid || null,
          regenType: r.regen_type || null,
          orgName: prof.org_name,
          handle: prof.handle,
        }
      } as const;
    })
    .filter(Boolean);

  return NextResponse.json({ type: "FeatureCollection", features });
}
