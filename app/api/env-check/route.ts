// app/api/env-check/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const envs = {
    SUPABASE_URL: process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    SERVICE_ROLE_KEY: process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  };
  const masked = Object.fromEntries(
    Object.entries(envs).map(([k, v]) => [k, v ? v.slice(0, 8) + "..." + v.slice(-6) : ""])
  );
  return NextResponse.json({ ok: true, present: {
    SUPABASE_URL: !!envs.SUPABASE_URL,
    SERVICE_ROLE_KEY: !!envs.SERVICE_ROLE_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: !!envs.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  }, masked });
}
