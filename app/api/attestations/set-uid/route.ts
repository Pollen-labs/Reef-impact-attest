import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type Body = { attestation_id: string; uid: string };

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || !body.attestation_id || !/^0x[0-9a-fA-F]{64}$/.test(body.uid)) {
    return NextResponse.json({ error: "Invalid attestation_id or uid" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("attestations")
    .update({ uid: body.uid })
    .eq("id", body.attestation_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

