// deno.json đã có permissions: "net", "env"
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.2/mod.ts";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMAIL_FROM    = Deno.env.get("EMAIL_FROM")!;         // "AP Truyendich <xxx@gmail.com>"
const SMTP_HOST     = Deno.env.get("SMTP_HOST")!;          // smtp.gmail.com
const SMTP_PORT     = Number(Deno.env.get("SMTP_PORT")||465);
const SMTP_USER     = Deno.env.get("SMTP_USER")!;
const SMTP_PASS     = Deno.env.get("SMTP_PASS")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE, {
  global: { headers: { Authorization: `Bearer ${SERVICE_ROLE}` } },
});

const smtp = new SMTPClient({
  connection: { hostname: SMTP_HOST, port: SMTP_PORT, tls: true, auth: { username: SMTP_USER, password: SMTP_PASS } },
});

async function sendEmail(to: string, subject: string, html: string) {
  try {
    await smtp.send({ from: EMAIL_FROM, to, subject, html });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

serve(async (req) => {
  try {
    // 1) Lấy các ca đến hạn (UTC)
    const nowIso = new Date().toISOString();
    const { data: due, error } = await sb
      .from("infusions")
      .select("*")
      .eq("status", "running")
      .lte("end_time", nowIso);
    if (error) throw error;

    let processed = 0, pushOK = 0, emailOK = 0;
    for (const it of due ?? []) {
      // 2) Gửi push (OneSignal) - OPTIONAL: gọi REST bằng ONESIGNAL_REST_API_KEY nếu bạn đã set
      // (bạn có thể thêm vào sau; tạm thời tập trung email + update status)

      // 3) Gửi email nếu tick
      if (it.email_notify && it.email_to) {
        const subj = `Kết thúc truyền: ${it.patient_name} (${it.room}/${it.bed})`;
        const html = `
          <p>Ca truyền đã kết thúc.</p>
          <ul>
            <li>Bệnh nhân: <b>${it.patient_name}</b></li>
            <li>Phòng/Giường: ${it.room}/${it.bed}</li>
            <li>Kết thúc: ${new Date(it.end_time).toLocaleString("vi-VN")}</li>
            <li>Ghi chú: ${it.note ?? ""}</li>
          </ul>`;
        const res = await sendEmail(it.email_to, subj, html);
        await sb.from("notification_log").insert({
          infusion_id: it.id, user_id: it.user_id,
          channel: "email", status: res.ok ? "success" : "failed",
          detail: res.ok ? null : res.error
        });
        if (res.ok) emailOK++;
      }

      // 4) Đánh dấu completed
      const { error: uerr } = await sb.from("infusions").update({ status: "completed" }).eq("id", it.id);
      if (!uerr) processed++;
    }

    return new Response(JSON.stringify({ ok: true, processed, pushOK, emailOK }), { status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e?.message || e) }), { status: 500 });
  }
});
