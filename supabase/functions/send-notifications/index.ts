// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * ENV cần có trong Secrets:
 * - SUPABASE_URL
 * - SUPABASE_SERVICE_ROLE_KEY (hoặc SERVICE_ROLE_KEY)
 * - RESEND_API_KEY
 * - RESEND_FROM           (ví dụ: 'AP Truyền dịch <onboarding@resend.dev>')
 * - RESEND_FALLBACK_TO    (email fallback khi không lấy được email user)
 * - ALLOWED_ORIGIN        (origin Netlify của bạn, ví dụ https://ap-truyendich.netlify.app)
 */

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY =
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const RESEND_FROM = Deno.env.get("RESEND_FROM") || "AP Truyền dịch <onboarding@resend.dev>";
const RESEND_FALLBACK_TO = Deno.env.get("RESEND_FALLBACK_TO") ?? "";
const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const supa = createClient(SUPABASE_URL, SERVICE_KEY);

// Small helpers
const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": ALLOWED_ORIGIN,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "authorization,content-type",
    },
  });

async function getUserEmail(userId: string | null): Promise<string | null> {
  if (!userId) return RESEND_FALLBACK_TO || null;
  try {
    const { data, error } = await supa.auth.admin.getUserById(userId);
    if (error) return RESEND_FALLBACK_TO || null;
    return data.user.email ?? (RESEND_FALLBACK_TO || null);
  } catch {
    return RESEND_FALLBACK_TO || null;
  }
}

async function sendMail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from: RESEND_FROM, to, subject, html }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Resend error ${res.status}: ${t}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return json({}, 200);

  const url = new URL(req.url);
  const dryRun = url.searchParams.has("dry_run");

  // 1) lấy danh sách ca cần thông báo (đến hạn, chưa gửi email)
  const now = new Date().toISOString();
  const { data: due, error } = await supa
    .from("infusions")
    .select(
      "id,user_id,patient_name,room,bed,volume_ml,drip_rate_dpm,drops_per_ml,end_time,notify_email,email_sent_at,status"
    )
    .eq("status", "scheduled")
    .lte("end_time", now)
    .is("email_sent_at", null);

  if (error) return json({ ok: false, message: error.message }, 500);

  const items: any[] = [];
  for (const row of due ?? []) {
    const to = row.notify_email ? await getUserEmail(row.user_id) : null;

    const subject = `Kết thúc truyền dịch – ${row.patient_name}`;
    const html = `
      <div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height:1.5">
        <h2>Ca truyền đã hoàn tất</h2>
        <p><strong>Bệnh nhân:</strong> ${row.patient_name}</p>
        <p><strong>Phòng/Giường:</strong> ${[row.room, row.bed].filter(Boolean).join(" - ")}</p>
        <p><strong>Giờ kết thúc:</strong> ${new Date(row.end_time).toLocaleString("vi-VN")}</p>
        <hr />
        <p>Đây là email tự động từ hệ thống AP - Truyền dịch.</p>
      </div>
    `;

    // 2) gửi email (nếu người dùng tick nhận email)
    if (to && !dryRun) {
      try {
        await sendMail(to, subject, html);
      } catch (e) {
        // không chặn cả lô, chỉ ghi lỗi và đi tiếp
        items.push({ infusion_id: row.id, email_error: String(e) });
      }
    }

    // 3) ghi log + cập nhật ca
    if (!dryRun) {
      // ghi log realtime (client sẽ nghe và popup)
      await supa.from("notification_log").insert({
        user_id: row.user_id,
        infusion_id: row.id,
        type: "email",
      });

      await supa
        .from("infusions")
        .update({ email_sent_at: new Date().toISOString(), status: "finished" })
        .eq("id", row.id);
    }

    items.push({
      infusion_id: row.id,
      push: { sent: false }, // để dành nếu sau này bật push server-side
      email: { willSend: !!to, to: to ?? undefined },
      dry: dryRun,
    });
  }

  return json({ ok: true, count: items.length, items });
});
