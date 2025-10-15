import { env } from "@/lib/env";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  if (!env.relayerUrl) {
    return NextResponse.json(
      { error: "RELAYER_URL not configured on server" },
      { status: 501 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const invokeKey = process.env.RELAYER_INVOKE_KEY || process.env.SUPABASE_ANON_KEY || "";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (invokeKey) {
    headers["authorization"] = `Bearer ${invokeKey}`;
    headers["apikey"] = invokeKey;
  }

  const res = await fetch(env.relayerUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }

  return NextResponse.json(json, { status: res.status });
}

export async function GET() {
  return NextResponse.json({ ok: true, relay: Boolean(env.relayerUrl) });
}
