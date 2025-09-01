// notify-overdue: tìm ca active quá hạn, gửi email (Resend), log idempotent, chuyển completed.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const EMAIL_FROM = Deno.env.get("EMAIL_FROM")!; // ví dụ: "ap-truyendich <no-reply@yourdomain>"

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

type DueInfusion = {
  id: string;
  user_id: string;
  patient_name: string;
  end_at: string;
  notify_email: boolean;
  status: "active" | "completed" | "canceled";
  profiles: { email: string | null; full_name: string | null } | null;
};

async function sendEmail(to: string, subject: string, html: string) {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: EMAIL_FROM, to: [to], subject, html }),
  });
  const ok = resp.ok;
  const text = ok ? "" : await resp.text();
  return { ok, text };
}

serve(async (req) => {
  // Cho phép GET để test thủ công; cron sẽ gọi POST.
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const nowIso = new Date().toISOString();

  // Lấy các ca active đã quá hạn (end_at <= now)
  const { data: due, error } = await supabase
    .from("infusions")
    .select(
      "id,user_id,patient_name,end_at,notify_email,status,profiles(email,full_name)"
    )
    .eq("status", "active")
    .lte("end_at", nowIso);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let emailed = 0;
  let already = 0;
  let updated = 0;
  let skipped = 0;
  const logs: Array<{ id: string; note: string }> = [];

  for (const row of (due ?? []) as DueInfusion[]) {
    processed++;

    // Nếu không bật notify_email hoặc không có email người dùng -> bỏ qua gửi
    const email = row?.profiles?.email ?? null;
    if (!row.notify_email || !email) {
      skipped++;
      // Dù không gửi email, vẫn chuyển completed để kết thúc vòng đời ca.
      const { error: updErr } = await supabase
        .from("infusions")
        .update({ status: "completed" })
        .eq("id", row.id);
      if (!updErr) updated++;
      logs.push({ id: row.id, note: "skipped-email->completed" });
      continue;
    }

    // Idempotent: kiểm tra đã log email chưa
    const { data: exists, error: selErr } = await supabase
      .from("notification_log")
      .select("id")
      .eq("infusion_id", row.id)
      .eq("type", "email")
      .maybeSingle();

    if (selErr) {
      logs.push({ id: row.id, note: `select-error:${selErr.message}` });
      // vẫn tiếp tục
    }

    if (exists) {
      already++;
    } else {
      // Gửi email
      const timeStr = new Date(row.end_at).toLocaleString("vi-VN");
      const subject = `Ca truyền đã kết thúc: ${row.patient_name}`;
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial">
          <h2>Ca truyền đã kết thúc</h2>
          <p>Ca truyền của <strong>${row.patient_name}</strong> đã kết thúc vào lúc <strong>${timeStr}</strong>.</p>
          <p>— ap-truyendich</p>
        </div>
      `;

      const { ok, text } = await sendEmail(email, subject, html);

      // Ghi log (unique infusion_id+type)
      await supabase.from("notification_log").insert({
        infusion_id: row.id,
        type: "email",
        success: ok,
        error_text: ok ? null : text,
      });

      if (ok) emailed++;
      logs.push({ id: row.id, note: ok ? "emailed" : `email-failed:${text}` });
    }

    // Chuyển completed (trigger sẽ set completed_at)
    const { error: updErr } = await supabase
      .from("infusions")
      .update({ status: "completed" })
      .eq("id", row.id);

    if (!updErr) updated++;
  }

  return new Response(
    JSON.stringify({ processed, emailed, already, updated, skipped, logs }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});
