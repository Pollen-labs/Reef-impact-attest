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

  const res = await fetch(env.relayerUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
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

