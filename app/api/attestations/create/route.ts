import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  profile_id?: string;
  wallet_address?: string; // if provided, we can lookup profile
  regen_type: "transplantation" | "nursery" | "other";
  action_date: string; // YYYY-MM-DD
  location_lat: number;
  location_lng: number;
  depth?: number | null;
  surface_area?: number | null;
  species?: string[];
  summary?: string | null;
  contributor_name?: string[];
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  let profileId = body.profile_id || "";
  if (!profileId && body.wallet_address) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .filter("wallet_address", "ilike", body.wallet_address)
      .maybeSingle();
    if (error && error.code !== "PGRST116") return NextResponse.json({ error: error.message }, { status: 500 });
    if (!data?.id) return NextResponse.json({ error: "Profile not found for wallet" }, { status: 400 });
    profileId = data.id;
  }

  if (!profileId) return NextResponse.json({ error: "profile_id is required" }, { status: 400 });
  if (!body.regen_type || !body.action_date || body.location_lat == null || body.location_lng == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const payload = {
    profile_id: profileId,
    regen_type: body.regen_type,
    action_date: body.action_date,
    location_lat: body.location_lat,
    location_lng: body.location_lng,
    depth: body.depth ?? null,
    surface_area: body.surface_area ?? null,
    species: body.species ?? [],
    summary: body.summary ?? null,
    contributor_name: body.contributor_name ?? [],
  } as const;

  const { data: inserted, error } = await supabaseAdmin
    .from("attestations")
    .insert(payload)
    .select("id")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, attestationId: inserted.id });
}

