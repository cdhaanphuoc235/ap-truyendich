// Deno runtime on Supabase Edge Functions
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

// SUPABASE_URL được Supabase inject sẵn -> dùng trực tiếp
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

// Service role key (đã set bằng 'SERVICE_ROLE_KEY' qua supabase secrets)
const serviceRole = Deno.env.get("SERVICE_ROLE_KEY")!;

// VAPID & EmailJS
const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY")!;
const emailSvc = Deno.env.get("EMAILJS_SERVICE_ID")!;
const emailTpl = Deno.env.get("EMAILJS_TEMPLATE_ID")!;
const emailPub = Deno.env.get("EMAILJS_PUBLIC_KEY")!;

const sb = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });
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
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });

  try {
    const now = new Date();
    const from = new Date(now.getTime() - 60_000).toISOString();
    const to = new Date(now.getTime() + 60_000).toISOString();

    const { data: infusions, error: e1 } = await sb
      .from('infusions')
      .select('id,user_id,patient_name,room,bed,end_time,notify_email,status')
      .gte('end_time', from)
      .lte('end_time', to)
      .eq('status', 'scheduled');

    if (e1) throw e1;

    let pushCount = 0, emailCount = 0;

    for (const inf of infusions ?? []) {
      const { data: subs } = await sb
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', inf.user_id);

      const loc = [inf.room, inf.bed].filter(Boolean).join(' - ');
      const title = "Kết thúc ca truyền";
      const body = `${inf.patient_name ?? 'Bệnh nhân'}${loc ? ` (${loc})` : ''} đã đến giờ kết thúc.`;

      for (const s of subs ?? []) {
        try {
          await webpush.sendNotification({
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth }
          }, JSON.stringify({ title, body, data: { url: "/" } }));
          pushCount++;
          await sb.from('notification_log').insert({ infusion_id: inf.id, channel: 'push', status: 'ok' });
        } catch (err) {
          await sb.from('notification_log').insert({ infusion_id: inf.id, channel: 'push', status: 'error', error: String(err) });
          if (String(err).includes('410') || String(err).includes('404')) {
            await sb.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
          }
        }
      }

      if (inf.notify_email) {
        try {
          await sendEmail(title, {
            patient_name: String(inf.patient_name ?? ''),
            room: String(inf.room ?? ''),
            bed: String(inf.bed ?? ''),
            end_time: String(inf.end_time ?? '')
          });
          emailCount++;
          await sb.from('notification_log').insert({ infusion_id: inf.id, channel: 'email', status: 'ok' });
        } catch (err) {
          await sb.from('notification_log').insert({ infusion_id: inf.id, channel: 'email', status: 'error', error: String(err) });
        }
      }

      await sb.from('infusions').update({ status: 'notified' }).eq('id', inf.id);
    }

    return new Response(JSON.stringify({ pushCount, emailCount }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(String(e), { status: 500 });
  }
});
