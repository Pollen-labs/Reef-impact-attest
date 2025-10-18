import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = (searchParams.get("address") || "").trim();
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("handle")
    .filter("wallet_address", "ilike", address)
    .maybeSingle();
  if (error && error.code !== "PGRST116") return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.handle) return NextResponse.json({ ok: true, handle: null });
  return NextResponse.json({ ok: true, handle: data.handle });
}

