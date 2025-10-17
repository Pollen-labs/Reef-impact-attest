import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Body = {
  wallet_address: string;
  org_name?: string;
  website?: string;
  description?: string;
  handle?: string;
};

function isAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function toBaseHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUniqueHandle(base: string, existingId?: string): Promise<string> {
  const b = toBaseHandle(base || "");
  if (!b) return "reef-user";
  let candidate = b;
  let suffix = 0;
  while (true) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id, handle")
      .ilike("handle", candidate)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw error; // ignore no rows
    if (!data || (existingId && data.id === existingId)) return candidate;
    suffix += 1;
    candidate = `${b}-${suffix}`;
  }
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !isAddress(body.wallet_address)) {
    return NextResponse.json({ error: "Invalid wallet_address" }, { status: 400 });
  }

  const walletLc = body.wallet_address.toLowerCase();

  // Try find existing by wallet (case-insensitive)
  const { data: found, error: findErr } = await supabaseAdmin
    .from("profiles")
    .select("id, handle, wallet_address")
    .filter("wallet_address", "ilike", walletLc)
    .maybeSingle();
  if (findErr && findErr.code !== "PGRST116") {
    return NextResponse.json({ error: findErr.message }, { status: 500 });
  }

  if (found?.id) {
    // Update existing minimal fields if provided
    const updates: Record<string, any> = {};
    if (body.org_name != null) updates.org_name = body.org_name;
    if (body.website != null) updates.website = body.website;
    if (body.description != null) updates.description = body.description;
    if (body.handle) updates.handle = await ensureUniqueHandle(body.handle, found.id);

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabaseAdmin
        .from("profiles")
        .update(updates)
        .eq("id", found.id);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, profileId: found.id });
  }

  // Create new profile
  const baseHandle = body.handle || `reef-${walletLc.slice(2, 8)}`;
  const handle = await ensureUniqueHandle(baseHandle);
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from("profiles")
    .insert({
      user_id: null,
      wallet_address: walletLc,
      org_name: body.org_name || "",
      website: body.website || null,
      description: body.description || null,
      handle,
    })
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, profileId: inserted.id, handle });
}

