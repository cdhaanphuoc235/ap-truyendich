// deno-lint-ignore-file no-explicit-any
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/** TRẢ CORS CHO MỌI REQUEST (đặc biệt là OPTIONS preflight) */
function buildCorsHeaders(origin: string | null) {
  // Nếu bạn set biến ALLOWED_ORIGIN, sẽ chỉ cho origin đó; nếu không, cho tất cả (*)
  const allowed = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
  const value = allowed === "*" ? "*" : (origin && origin === allowed ? origin : allowed);
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
const ok = (body: unknown, cors: Record<string, string>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...cors } });

/** Gửi email qua EmailJS REST */
async function sendEmail(EMAILJS: {SERVICE_ID: string; TEMPLATE_ID: string; PUBLIC_KEY: string}, toEmail: string, params: Record<string, string>) {
  const { SERVICE_ID, TEMPLATE_ID, PUBLIC_KEY } = EMAILJS;
  try {
    const r = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: SERVICE_ID,
        template_id: TEMPLATE_ID,
        user_id: PUBLIC_KEY,
        template_params: { to_email: toEmail, ...params },
      }),
    });
    if (!r.ok) throw new Error(await r.text());
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

/** Gửi Web Push */
async function sendPush(subscription: any, payload: any) {
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (e) { return { ok: false, error: String(e) }; }
}

serve(async (req) => {
  const cors = buildCorsHeaders(req.headers.get("Origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // ---- Chỉ sau khi pass preflight mới đọc ENV + khởi tạo client ----
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("URL") ?? "";
  const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
  const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
  const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
  const EMAILJS = {
    SERVICE_ID: Deno.env.get("EMAILJS_SERVICE_ID") ?? "",
    TEMPLATE_ID: Deno.env.get("EMAILJS_TEMPLATE_ID") ?? "",
    PUBLIC_KEY: Deno.env.get("EMAILJS_PUBLIC_KEY") ?? "",
  };

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return ok({ ok: false, error: "Missing SUPABASE_URL/URL or SERVICE_ROLE_KEY" }, cors, 500);
  }
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return ok({ ok: false, error: "Missing VAPID keys" }, cors, 500);
  }
  webpush.setVapidDetails("mailto:no-reply@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // lấy body an toàn
  let body: any = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const mode = body?.mode; // 'test' | 'scan' hoặc undefined => quét scheduled
  const nowISO = new Date().toISOString();

  try {
    // TEST: gửi thử push/email cho user đầu tiên có subscription
    if (mode === "test") {
      const { data: s, error } = await supabase.from("push_subscriptions").select("endpoint,keys,user_id").limit(1);
      if (error) throw error;
      if (!s || !s.length) return ok({ ok: false, error: "No subscription found" }, cors, 400);

      const sub = s[0];
      const payload = { title: "TEST • Đã hết giờ truyền!", body: "Chuông báo thử nghiệm", url: "/app", tag: "test" };
      const p = await sendPush(sub, payload);

      // email demo tới chủ account
      const { data: u } = await supabase.auth.admin.getUserById(sub.user_id);
      const email = u.user?.email;
      let em: any = { ok: false, skipped: true };
      if (email) em = await sendEmail(EMAILJS, email, {
        patient_name: "TEST",
        room: "101",
        bed: "01",
        end_time: new Date().toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }),
      });

      return ok({ ok: true, test: { push: p, email: em } }, cors);
    }

    // SCAN: tìm các ca đến hạn và chưa done
    const { data: due, error: dueErr } = await supabase
      .from("infusions")
      .select("id,user_id,patient_name,room,bed,end_time,notify_email,status")
      .lte("end_time", nowISO)
      .neq("status", "done");
    if (dueErr) throw dueErr;

    if (!due || !due.length) return ok({ ok: true, count: 0, message: "No due infusions" }, cors);

    // gom subscriptions theo user
    const ids = Array.from(new Set(due.map(d => d.user_id)));
    const { data: subs, error: subErr } = await supabase
      .from("push_subscriptions")
      .select("endpoint,keys,user_id")
      .in("user_id", ids);
    if (subErr) throw subErr;

    let pushCount = 0, emailCount = 0;

    for (const inf of due) {
      const title = "Đã hết giờ truyền!";
      const bodyTxt = `${inf.patient_name ?? "Bệnh nhân"} • P.${inf.room ?? ""} • G.${inf.bed ?? ""}`;
      const payload = { title, body: bodyTxt, url: "/app", tag: `infusion-${inf.id}` };

      for (const s of (subs || []).filter(x => x.user_id === inf.user_id)) {
        const r = await sendPush(s, payload);
        if (r.ok) pushCount++;
      }

      if (inf.notify_email) {
        const { data: u } = await supabase.auth.admin.getUserById(inf.user_id);
        const email = u.user?.email;
        if (email) {
          const endVN = new Date(inf.end_time).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
          const r = await sendEmail(EMAILJS, email, {
            patient_name: String(inf.patient_name ?? ""),
            room: String(inf.room ?? ""),
            bed: String(inf.bed ?? ""),
            end_time: endVN,
          });
          if (r.ok) emailCount++;
        }
      }
    }

    // đánh dấu done
    const idsToDone = due.map(d => d.id);
    await supabase.from("infusions").update({ status: "done" }).in("id", idsToDone);

    return ok({ ok: true, count: due.length, pushCount, emailCount }, cors);
  } catch (e) {
    console.error(e);
    return ok({ ok: false, error: String(e) }, cors, 500);
  }
});
