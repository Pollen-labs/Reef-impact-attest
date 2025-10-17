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
  if (!env.relayerUrl) {
    return NextResponse.json({ ok: false, error: "RELAYER_URL not set" }, { status: 500 });
  }
  try {
    const res = await fetch(env.relayerUrl, { method: "GET" });
    const json = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: true, relayerUrl: env.relayerUrl, worker: json }, { status: res.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, relayerUrl: env.relayerUrl, error: e?.message || String(e) }, { status: 500 });
  }
}
