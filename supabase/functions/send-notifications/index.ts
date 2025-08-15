// supabase/functions/send-notifications/index.ts
// Deno Edge Function – GỬI EMAIL bằng Resend, KHÔNG dùng SDK Node

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ==== ENV ====
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM")!;
const RESEND_FALLBACK_TO = Deno.env.get("RESEND_FALLBACK_TO") || "";

// ==== Supabase client (service role) ====
const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// Helper: gửi email qua Resend REST API (thuần fetch)
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
    const body = await res.text();
    console.error("Resend error", res.status, body);
    throw new Error(`Resend ${res.status}: ${body}`);
  }
}

serve(async (req) => {
  try {
    const url = new URL(req.url);
    const dryRun = url.searchParams.has("dry_run");

    // Lấy những ca đang "scheduled" và đã đến hạn (end_time <= now)
    const nowIso = new Date().toISOString();
    const { data: due, error } = await sb
      .from("infusions")
      .select("id, user_id, patient_name, room, bed, end_time, notify_email")
      .eq("status", "scheduled")
      .lte("end_time", nowIso)
      .limit(50);

    if (error) {
      return new Response(
        JSON.stringify({ ok: false, message: error.message }),
        { status: 500 },
      );
    }

    const items: unknown[] = [];

    for (const row of due ?? []) {
      // Bỏ qua nếu không bật nhận email
      if (!row.notify_email) continue;

      // Lấy email người tạo ca bằng Admin API (cần service role)
      const { data: userRes, error: userErr } = await sb.auth.admin.getUserById(
        row.user_id,
      );
      let to = userRes?.user?.email ?? RESEND_FALLBACK_TO;

      if (userErr) console.warn("getUserById error", userErr.message);
      if (!to) {
        console.warn("No recipient email for infusion", row.id);
        continue;
      }

      const subject = `Ca truyền kết thúc - ${row.patient_name}`;
      const endAt = new Date(row.end_time).toLocaleString("vi-VN");
      const html = `
        <p>Ca truyền của <b>${row.patient_name}</b> đã kết thúc.</p>
        <ul>
          <li>Phòng: <b>${row.room ?? "-"}</b></li>
          <li>Giường: <b>${row.bed ?? "-"}</b></li>
          <li>Thời điểm kết thúc: <b>${endAt}</b></li>
        </ul>
        <p>— AP Truyền dịch</p>
      `;

      items.push({
        infusion_id: row.id,
        email: { to, subject },
      });

      if (!dryRun) {
        // 1) Gửi email
        try {
          await sendEmail(to, subject, html);
        } catch (e) {
          console.error("sendEmail failed", e);
        }

        // 2) Ghi log
        try {
          await sb.from("notification_log").insert({
            infusion_id: row.id,
            channel: "email",
            meta: { to, subject },
          });
        } catch (e) {
          console.error("insert log failed", e);
        }

        // 3) Cập nhật trạng thái ca thành 'completed'
        try {
          await sb.from("infusions").update({ status: "completed" }).eq(
            "id",
            row.id,
          );
        } catch (e) {
          console.error("update status failed", e);
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, count: items.length, items, dry: dryRun }),
      { headers: { "content-type": "application/json" } },
    );
  } catch (err) {
    console.error("Function error", err);
    return new Response(
      JSON.stringify({ ok: false, message: String(err) }),
      { status: 500 },
    );
  }
});
