// supabase/functions/cron_dispatcher/index.ts
// Quét ca đến hạn mỗi lần gọi → gửi OneSignal push + (tùy chọn) email qua notify_email → log → set completed.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Infusion = {
  id: string;
  user_id: string;
  patient_name: string;
  end_time: string;      // timestamptz
  wants_email: boolean;
  email_to: string | null;
  status: "running" | "completed" | "canceled";
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // Bảo vệ function: yêu cầu Authorization Bearer = SERVICE_ROLE (cron sẽ gửi header này)
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ") || auth.slice(7).trim() !== SERVICE_ROLE) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    // 1) Lấy danh sách ca đến hạn
    const nowIso = new Date().toISOString();
    const { data: due, error } = await supabase
      .from("infusions")
      .select("id, user_id, patient_name, end_time, wants_email, email_to, status")
      .eq("status", "running")
      .lte("end_time", nowIso)
      .order("end_time", { ascending: true })
      .limit(200);

    if (error) throw error;
    const items: Infusion[] = due || [];
    if (!items.length) return json({ ok: true, processed: 0 });

    let pushOK = 0, pushFail = 0, mailOK = 0, mailFail = 0, completed = 0;

    // 2) Xử lý từng ca (đủ chậm để an toàn; nếu nhiều có thể tối ưu thêm)
    for (const inf of items) {
      // 2a) Gửi Push qua OneSignal, target theo external_id = user_id
      //     Endpoint: POST https://api.onesignal.com/notifications?c=push
      //     Header: Authorization: Key <REST_API_KEY>, Content-Type: application/json
      //     Body: { app_id, include_aliases: { external_id: [ inf.user_id ] }, target_channel: "push", ... }
      //     Tài liệu: docs OneSignal REST push. 
      const endLocal = new Date(inf.end_time).toLocaleString();
      const body = {
        app_id: ONESIGNAL_APP_ID,
        include_aliases: { external_id: [inf.user_id] },
        target_channel: "push",
        headings: { vi: "Ca truyền kết thúc", en: "Infusion finished" },
        contents: {
          vi: `BN: ${inf.patient_name} — Kết thúc: ${endLocal}`,
          en: `Patient: ${inf.patient_name} — End: ${endLocal}`,
        },
        web_url: "", // có thể đặt URL app Netlify nếu muốn mở app khi ấn
        data: { infusion_id: inf.id },
      };

      try {
        const res = await fetch("https://api.onesignal.com/notifications?c=push", {
          method: "POST",
          headers: {
            "Authorization": `Key ${ONESIGNAL_REST_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        const ok = res.ok;
        const detail = await safeText(res);
        await insertLog(supabase, inf.id, inf.user_id, "push", ok ? "success" : "failed", detail);
        if (ok) pushOK++; else pushFail++;
      } catch (e) {
        await insertLog(supabase, inf.id, inf.user_id, "push", "failed", String(e?.message ?? e));
        pushFail++;
      }

      // 2b) Gửi Email nếu được yêu cầu (gọi function notify_email đã làm ở Bước 5)
      if (inf.wants_email) {
        try {
          const resMail = await fetch(`${SUPABASE_URL}/functions/v1/notify_email`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${SERVICE_ROLE}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ infusion_id: inf.id }),
          });
          const ok = resMail.ok;
          const detail = await safeText(resMail);
          // notify_email tự log channel=email; ở đây không log lại để tránh trùng, chỉ đếm
          if (ok) mailOK++; else mailFail++;
        } catch (e) {
          await insertLog(supabase, inf.id, inf.user_id, "email", "failed", String(e?.message ?? e));
          mailFail++;
        }
      }

      // 2c) Set completed (tránh gửi lặp ở lần cron sau)
      const { error: upErr } = await supabase
        .from("infusions")
        .update({ status: "completed" })
        .eq("id", inf.id)
        .eq("status", "running"); // idempotent
      if (!upErr) completed++;
    }

    return json({ ok: true, processed: items.length, pushOK, pushFail, mailOK, mailFail, completed });
  } catch (e) {
    console.error(e);
    return json({ error: String(e?.message ?? e) }, 500);
  }
});

async function insertLog(
  supabase: any,
  infusion_id: string,
  user_id: string,
  channel: "push" | "email",
  status: "success" | "failed",
  detail: string
) {
  const { error } = await supabase.from("notification_log").insert({ infusion_id, user_id, channel, status, detail });
  if (error) console.error("insertLog error:", error);
}
async function safeText(res: Response) {
  try { return await res.text(); } catch { return ""; }
}
