// supabase/functions/send-notifications/index.ts
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
    template_params: { to_email, subject, ...params },
  };
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`EmailJS ${res.status}: ${await res.text()}`);
}

async function sendPushToUser(user_id: string, title: string, body: string) {
  const { data: subs } = await sb.from("push_subscriptions").select("endpoint,p256dh,auth").eq("user_id", user_id);
  let ok = 0, err = 0;
  for (const s of subs ?? []) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title, body, data: { url: "/" } })
      );
      ok++;
    } catch (e) {
      err++;
      if (String(e).includes("410") || String(e).includes("404")) {
        await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
  }
  return { ok, err };
}

serve(async (req) => {
  if (req.method !== "POST") return new Response("Use POST", { status: 405 });

  try {
    // ====== TEST MODE ======
    let bodyJson: any = null;
    try { bodyJson = await req.json(); } catch {}
    if (bodyJson && bodyJson.mode === "test") {
      const user_id: string = bodyJson.user_id;
      if (!user_id) return new Response("Missing user_id", { status: 400 });

      const { data: admin } = await sb.auth.admin.getUserById(user_id);
      const email = admin?.user?.email || "";

      const title = "Test thông báo";
      const body = "Đây là thông báo thử (Push + Email).";

      const p = await sendPushToUser(user_id, title, body);
      let eok = false, eerr: string | null = null;
      if (email) {
        try {
          await sendEmail(email, title, { patient_name: "", room: "", bed: "", end_time: new Date().toISOString() });
          eok = true;
        } catch (e) { eerr = String(e); }
      }

      const result = { mode: "test", push: p, email: { ok: eok, err: eerr } };
      console.log(JSON.stringify(result));
      return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
    }

    // ====== NORMAL MODE (quét end_time ±1 phút) ======
    const now = new Date();
    const from = new Date(now.getTime() - 60_000).toISOString();
    const to   = new Date(now.getTime() + 60_000).toISOString();

    const { data: infusions, error: qErr } = await sb
      .from("infusions")
      .select("id,user_id,patient_name,room,bed,end_time,notify_email,status")
      .gte("end_time", from).lte("end_time", to).eq("status", "scheduled");
    if (qErr) throw qErr;

    let pushCount = 0, emailCount = 0;
    for (const inf of infusions ?? []) {
      const loc = [inf.room, inf.bed].filter(Boolean).join(" - ");
      const title = "Kết thúc ca truyền";
      const body  = `${inf.patient_name ?? "Bệnh nhân"}${loc ? ` (${loc})` : ""} đã đến giờ kết thúc.`;

      const p = await sendPushToUser(inf.user_id, title, body);
      pushCount += p.ok;

      if (inf.notify_email) {
        const { data: admin } = await sb.auth.admin.getUserById(inf.user_id);
        const email = admin?.user?.email || "";
        if (email) {
          try {
            await sendEmail(email, title, {
              patient_name: String(inf.patient_name ?? ""), room: String(inf.room ?? ""),
              bed: String(inf.bed ?? ""), end_time: String(inf.end_time ?? "")
            });
            emailCount++;
          } catch (e) {
            await sb.from("notification_log").insert({ infusion_id: inf.id, channel: "email", status: "error", error: String(e) });
          }
        }
      }

      await sb.from("infusions").update({ status: "notified" }).eq("id", inf.id);
    }

    const result = { found: (infusions ?? []).length, pushCount, emailCount };
    console.log(JSON.stringify(result));
    return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });

  } catch (e) {
    console.error("send-notifications error:", e);
    return new Response(String(e?.message ?? e), { status: 500 });
  }
});
