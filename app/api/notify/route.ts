// app/api/notify/route.ts
import { NextResponse } from "next/server";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY =
  process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/** Gọi Edge Function ở Supabase (server -> server, không CORS) */
async function callEdge(mode: string) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    const miss = {
      SUPABASE_URL: !!SUPABASE_URL,
      SERVICE_ROLE_KEY: !!SERVICE_ROLE_KEY,
    };
    return {
      status: 500,
      data: { ok: false, reason: "missing_env", missing: miss },
    };
  }

  // Chuẩn hóa URL (tránh //)
  const base = SUPABASE_URL.replace(/\/+$/, "");
  const url = `${base}/functions/v1/send-notifications`;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ mode }),
    });
  } catch (e: any) {
    return { status: 502, data: { ok: false, reason: "fetch_failed", error: String(e?.message || e) } };
  }

  const text = await res.text();
  let json: any = text;
  try { json = JSON.parse(text); } catch {}

  return { status: res.status, data: json };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "scan"; // "test" | "scan"
  const { status, data } = await callEdge(mode);
  return NextResponse.json(data, { status });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode || "scan";
  const { status, data } = await callEdge(mode);
  return NextResponse.json(data, { status });
}
