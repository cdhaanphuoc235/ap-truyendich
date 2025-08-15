// app/api/notify/route.ts
import { NextResponse } from "next/server";

/**
 * Proxy server-side -> gọi Supabase Edge Function
 * Ưu điểm: không CORS, không lộ SERVICE_ROLE_KEY ra client
 */

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!SUPABASE_URL) {
  console.warn("[/api/notify] Missing SUPABASE_URL env");
}
if (!SERVICE_ROLE_KEY) {
  console.warn("[/api/notify] Missing SERVICE_ROLE_KEY env");
}

async function callEdge(mode: string) {
  const url = `${SUPABASE_URL}/functions/v1/send-notifications`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // SERVICE_ROLE_KEY chỉ dùng server -> server. KHÔNG dùng ở client!
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ mode }),
  });
  const data = await r
    .json()
    .catch(() => ({ ok: false, error: "Invalid JSON from function" }));
  return { status: r.status, data };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "scan"; // "test" | "scan"
  const { status, data } = await callEdge(mode);
  return NextResponse.json(data, { status });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode || "scan"; // "test" | "scan"
  const { status, data } = await callEdge(mode);
  return NextResponse.json(data, { status });
}
