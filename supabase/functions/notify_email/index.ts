// supabase/functions/notify_email/index.ts
// Gửi email bằng Gmail SMTP khi ca truyền kết thúc + ghi notification_log

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { SmtpClient } from "https://deno.land/x/smtp@v0.7.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SMTP_HOST = Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com";
const SMTP_PORT = Number(Deno.env.get("SMTP_PORT") ?? "465");
const SMTP_USER = Deno.env.get("SMTP_USER")!;
const SMTP_PASS = Deno.env.get("SMTP_PASS")!;
const EMAIL_FROM = Deno.env.get("EMAIL_FROM") ?? SMTP_USER;

type Infusion = {
  id: string;
  user_id: string;
  patient_name: string;
  end_time: string;         // timestamptz
  wants_email: boolean;
  email_to: string | null;
  status: string;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

async function fetchInfusionById(supabase: any, id: string): Promise<Infusion | null> {
  const { data, error } = await supabase
    .from("infusions")
    .select("id, user_id, patient_name, end_time, wants_email, email_to, status")
    .eq("id", id)
    .single();

  if (error) {
    console.error("fetchInfusionById error:", error);
    return null;
  }
  return data;
}

async function getUserEmail(supabase: any, user_id: string): Promise<string | null> {
  // Yêu cầu service role
  const { data, error } = await supabase.auth.admin.getUserById(user_id);
  if (error) {
    console.error("getUserEmail error:", error);
    return null;
  }
  return data?.user?.email ?? null;
}

async function sendEmailGmailTLS(opts: {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}) {
  const client = new SmtpClient();
  await client.connectTLS({
    hostname: SMTP_HOST,
    port: SMTP_PORT,
    username: SMTP_USER,
    password: SMTP_PASS,
  });

  try {
    await client.send({
      from: EMAIL_FROM,
      to: opts.to,
      subject: opts.subject,
      content: opts.text ?? "",
      html: opts.html,
    });
  } finally {
    await client.close();
  }
}

async function insertLog(
  supabase: any,
  infusion_id: string,
  user_id: string,
  status: "success" | "failed",
  detail: string
) {
  const { error } = await supabase.from("notification_log").insert({
    infusion_id,
    user_id,
    channel: "email",
    status,
    detail,
  });
  if (error) console.error("insertLog error:", error);
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const infusion_id = String(body?.infusion_id ?? "");

    if (!infusion_id) {
      return json({ error: "Missing infusion_id" }, 400);
    }

    const infusion = await fetchInfusionById(supabase, infusion_id);
    if (!infusion) return json({ error: "Infusion not found" }, 404);

    // Chỉ gửi email nếu wants_email = true
    if (infusion.status !== "running" && infusion.status !== "completed") {
      await insertLog(supabase, infusion.id, infusion.user_id, "failed", "Invalid status");
      return json({ ok: false, message: `Invalid status: ${infusion.status}` }, 400);
    }
    if (!infusion.wants_email) {
      await insertLog(supabase, infusion.id, infusion.user_id, "failed", "wants_email=false");
      return json({ ok: false, message: "wants_email is false → skip" }, 200);
    }

    // Xác định email nhận
    let toEmail = infusion.email_to;
    if (!toEmail) {
      toEmail = await getUserEmail(supabase, infusion.user_id);
    }
    if (!toEmail) {
      await insertLog(supabase, infusion.id, infusion.user_id, "failed", "No recipient email");
      return json({ ok: false, message: "Không tìm thấy email người nhận" }, 400);
    }

    // Nội dung email
    const subject = `AP - Truyendich: Ca truyền kết thúc - ${infusion.patient_name}`;
    const endLocal = new Date(infusion.end_time).toLocaleString();
    const text = [
      `Ca truyền của bệnh nhân: ${infusion.patient_name}`,
      `Kết thúc vào: ${endLocal}`,
      "",
      "Đây là email tự động từ hệ thống AP - Truyendich.",
    ].join("\n");
    const html = `
      <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;line-height:1.5">
        <h2>AP - Truyendich</h2>
        <p><b>Bệnh nhân:</b> ${escapeHTML(infusion.patient_name)}</p>
        <p><b>Thời điểm kết thúc:</b> ${escapeHTML(endLocal)}</p>
        <hr/>
        <p style="color:#64748b">Đây là email tự động từ hệ thống AP - Truyendich.</p>
      </div>
    `;

    // Gửi SMTP
    await sendEmailGmailTLS({ to: toEmail, subject, text, html });

    // Ghi log
    await insertLog(supabase, infusion.id, infusion.user_id, "success", "Email sent via Gmail SMTP");

    return json({ ok: true, message: "Email sent", to: toEmail });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

function escapeHTML(s: string) {
  return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!));
}
