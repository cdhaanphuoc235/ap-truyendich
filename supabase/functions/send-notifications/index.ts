// Deno runtime on Supabase Edge Functions
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!;

const VAPID_PUBLIC_KEY  = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;

const EMAILJS_SERVICE_ID  = Deno.env.get("EMAILJS_SERVICE_ID")!;
const EMAILJS_TEMPLATE_ID = Deno.env.get("EMAILJS_TEMPLATE_ID")!;
const EMAILJS_PUBLIC_KEY  = Deno.env.get("EMAILJS_PUBLIC_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

webpush.setVapidDetails("mailto:noreply@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

async function sendEmail(to_email: string, subject: string, params: Record<string, string>) {
  const payload = {
    service_id: EMAILJS_SERVICE_ID,
    template_id: EMAILJS_TEMPLATE_ID,
    user_id: EMAILJS_PUBLIC_KEY,
    template_params: { to_email, subject, ...params }
  };
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`EmailJS ${res.status}: ${await res.text()}`);
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });

  try {
    const now = new Date();
    const from = new Date(now.getTime() - 60_000).toISOString();
    const to   = new Date(now.getTime() + 60_000).toISOString();

    const { data: infusions, error: qErr } = await sb
      .from("infusions")
      .select("id,user_id,patient_name,room,bed,end_time,notify_email,status")
      .gte("end_time", from)
      .lte("end_time", to)
      .eq("status", "scheduled");

    if (qErr) throw qErr;

    let pushCount = 0;
    let emailCount = 0;

    for (const inf of infusions ?? []) {
      const { data: subs } = await sb
        .from("push_subscriptions")
        .select("endpoint,p256dh,auth")
        .eq("user_id", inf.user_id);

      const loc = [inf.room, inf.bed].filter(Boolean).join(" - ");
      const title = "Kết thúc ca truyền";
      const body = `${inf.patient_name ?? "Bệnh nhân"}${loc ? ` (${loc})` : ""} đã đến giờ kết thúc.`;

      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify({ title, body, data: { url: "/" } })
          );
          pushCount++;
          await sb.from("notification_log").insert({ infusion_id: inf.id, channel: "push", status: "ok" });
        } catch (err) {
          await sb.from("notification_log").insert({ infusion_id: inf.id, channel: "push", status: "error", error: String(err) });
          if (String(err).includes("410") || String(err).includes("404")) {
            await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
          }
        }
      }

      if (inf.notify_email) {
        const { data: admin } = await sb.auth.admin.getUserById(inf.user_id);
        const toEmail = admin?.user?.email;
        if (toEmail) {
          try {
            await sendEmail(toEmail, title, {
              patient_name: String(inf.patient_name ?? ""),
              room: String(inf.room ?? ""),
              bed: String(inf.bed ?? ""),
              end_time: String(inf.end_time ?? "")
            });
            emailCount++;
            await sb.from("notification_log").insert({ infusion_id: inf.id, channel: "email", status: "ok" });
          } catch (err) {
            await sb.from("notification_log").insert({ infusion_id: inf.id, channel: "email", status: "error", error: String(err) });
          }
        } else {
          await sb.from("notification_log").insert({ infusion_id: inf.id, channel: "email", status: "skip", error: "no user email" });
        }
      }

      await sb.from("infusions").update({ status: "notified" }).eq("id", inf.id);
    }

    return new Response(JSON.stringify({ pushCount, emailCount }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (e) {
    return new Response(String(e?.message ?? e), { status: 500 });
  }
});
