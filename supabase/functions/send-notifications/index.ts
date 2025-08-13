// Deno runtime on Supabase Edge Functions
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
const emailSvc = Deno.env.get("EMAILJS_SERVICE_ID")!;
const emailTpl = Deno.env.get("EMAILJS_TEMPLATE_ID")!;
const emailPub = Deno.env.get("EMAILJS_PUBLIC_KEY")!;

const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

webpush.setVapidDetails("mailto:noreply@example.com", vapidPublic, vapidPrivate);

async function sendEmail(subject: string, params: Record<string,string>) {
  const body = {
    service_id: emailSvc,
    template_id: emailTpl,
    user_id: emailPub,
    template_params: { subject, ...params }
  };
  await fetch('https://api.emailjs.com/api/v1.0/email/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Use POST', { status: 405 });
  }

  try {
    const now = new Date();
    const from = new Date(now.getTime() - 60_000).toISOString();
    const to = new Date(now.getTime() + 60_000).toISOString();

    // Lấy các ca kết thúc trong khoảng [now-1m, now+1m], còn status 'scheduled'
    const { data: infusions, error: e1 } = await sb
      .from('infusions')
      .select('*')
      .gte('end_time', from)
      .lte('end_time', to)
      .eq('status', 'scheduled');

    if (e1) throw e1;

    let pushCount = 0, emailCount = 0;

    for (const inf of infusions ?? []) {
      // Lấy subscriptions của user
      const { data: subs } = await sb
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', inf.user_id);

      // Gửi Push
      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification({
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth }
          }, JSON.stringify({
            title: "Kết thúc ca truyền",
            body: `${inf.patient_name}: ${inf.drug_name} đã đến giờ.`,
            data: { url: "/" }
          }));
          pushCount++;
          await sb.from('notification_log').insert({ infusion_id: inf.id, channel: 'push', status: 'ok' });
        } catch (err) {
          // Nếu endpoint hết hạn → có thể xóa khỏi DB
          await sb.from('notification_log').insert({ infusion_id: inf.id, channel: 'push', status: 'error', error: String(err) });
          if (String(err).includes('410') || String(err).includes('404')) {
            await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          }
        }
      }

      // Email (nếu user chọn)
      if (inf.notify_email) {
        try {
          await sendEmail("Kết thúc ca truyền", {
            patient_name: String(inf.patient_name),
            drug_name: String(inf.drug_name),
            end_time: String(inf.end_time)
          });
          emailCount++;
          await sb.from('notification_log').insert({ infusion_id: inf.id, channel: 'email', status: 'ok' });
        } catch (err) {
          await sb.from('notification_log').insert({ infusion_id: inf.id, channel: 'email', status: 'error', error: String(err) });
        }
      }

      // Cập nhật trạng thái để không gửi lặp
      await sb.from('infusions').update({ status: 'notified' }).eq('id', inf.id);
    }

    return new Response(JSON.stringify({ pushCount, emailCount }), { headers: { 'Content-Type': 'application/json' }});
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
