// supabase/functions/send-notifications/index.ts

// YÊU CẦU secrets trong Supabase (Dashboard ➜ Edge Functions ➜ Secrets):
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY  (hoặc SERVICE_ROLE_KEY)
// - RESEND_API_KEY
// - RESEND_FROM   (ví dụ: "AP Truyền dịch <no-reply@yourdomain.com>")
// - RESEND_FALLBACK_TO (tùy chọn, email nhận fallback khi không tìm được email user)
// - APP_ORIGIN (vd: https://ap-truyendich.netlify.app hoặc * để debug)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM")!;
const RESEND_FALLBACK_TO = Deno.env.get("RESEND_FALLBACK_TO") ?? "";
const APP_ORIGIN = Deno.env.get("APP_ORIGIN") ?? "*";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false }});

type Infusion = {
  id: string;
  user_id: string | null;
  patient_name: string | null;
  room: string | null;
  bed: string | null;
  end_time: string;
  notify_email: boolean | null;
  email_sent_at: string | null;
  status: string | null;
};

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Resend error ${res.status}: ${t}`);
  }
}

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": APP_ORIGIN,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.get("dry_run") === "1";

    // Lấy các ca sẽ kết thúc trong 60s tới, chưa gửi email, còn 'scheduled'
    const until = new Date(Date.now() + 60_000).toISOString();

    const { data: due, error } = await admin
      .from("infusions")
      .select("id,user_id,patient_name,room,bed,end_time,notify_email,email_sent_at,status")
      .lte("end_time", until)
      .is("email_sent_at", null)
      .eq("status", "scheduled");

    if (error) throw error;

    const list: Infusion[] = due ?? [];

    // gom user_id cần email
    const userIds = Array.from(
      new Set(list.filter((x) => x.user_id && x.notify_email).map((x) => x.user_id as string))
    );

    // map user_id -> email từ auth.users (dùng service role)
    let userEmailMap = new Map<string, string>();
    if (userIds.length) {
      const { data: users, error: userErr } = await admin
        .schema("auth")
        .from("users")
        .select("id,email")
        .in("id", userIds);
      if (userErr) throw userErr;
      (users ?? []).forEach((u) => { if (u.id && u.email) userEmailMap.set(u.id, u.email); });
    }

    let sent = 0;
    const items: any[] = [];

    for (const it of list) {
      const finishAt = new Date(it.end_time);
      const subject = `Hoàn tất truyền dịch cho ${it.patient_name ?? "bệnh nhân"}`;
      const html = `
        <div>
          <p><strong>Thông báo:</strong> Ca truyền đã kết thúc.</p>
          <ul>
            <li>Bệnh nhân: ${it.patient_name ?? "-"}</li>
            <li>Phòng - Giường: ${it.room ?? "-"} - ${it.bed ?? "-"}</li>
            <li>Thời điểm kết thúc: ${finishAt.toLocaleString("vi-VN")}</li>
          </ul>
        </div>`;

      if (it.notify_email) {
        const to = (it.user_id ? userEmailMap.get(it.user_id) : undefined) || RESEND_FALLBACK_TO;
        if (to && !dryRun) await sendEmail(to, subject, html);

        items.push({ infusion_id: it.id, to: to ?? "(no-email)", dry: dryRun });

        if (!dryRun) {
          // cập nhật trạng thái & log
          await admin.from("infusions").update({
            email_sent_at: new Date().toISOString(),
            status: "finished",
          }).eq("id", it.id);

          await admin.from("notification_log").insert([
            { user_id: it.user_id, infusion_id: it.id, type: "email" },
            { user_id: it.user_id, infusion_id: it.id, type: "in_app" }, // cho realtime client
          ]);
        }
        sent++;
      }
    }

    return new Response(JSON.stringify({ ok: true, count: sent, items }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": APP_ORIGIN },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, message: String(e?.message ?? e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": APP_ORIGIN },
    });
  }
});
