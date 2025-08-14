'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

type Permission = 'default' | 'denied' | 'granted';
type Info = {
  sw: string;
  permission: Permission;
  subscribed: boolean;
  endpoint?: string;
  vapidLen: number;
};

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

function u8(base64: string) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = typeof atob === 'function' ? atob(base) : '';
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export default function DebugPage() {
  const supabase = getSupabase();

  // KHÔNG đọc Notification khi render -> để giá trị mặc định, cập nhật trong useEffect
  const [info, setInfo] = useState<Info>({
    sw: 'checking',
    permission: 'default',
    subscribed: false,
    vapidLen: VAPID_PUBLIC.length,
  });
  const [log, setLog] = useState<string>('');
  const append = (s: string) => setLog(x => x + s + '\n');

  const refresh = async () => {
    try {
      let sw = 'unsupported';
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration('/');
        sw = reg ? 'registered' : 'not-registered';
      }

      let subscribed = false, endpoint: string | undefined;
      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        subscribed = !!sub;
        endpoint = sub?.endpoint;
      }

      const permission: Permission =
        typeof window !== 'undefined' && 'Notification' in window
          ? (Notification.permission as Permission)
          : 'default';

      setInfo({ sw, permission, subscribed, endpoint, vapidLen: VAPID_PUBLIC.length });
    } catch (e: any) {
      append('refresh error: ' + (e?.message || e));
    }
  };

  useEffect(() => { refresh(); }, []);

  const doSubscribe = async () => {
    try {
      if (!(typeof window !== 'undefined' && 'Notification' in window)) {
        append('Trình duyệt không hỗ trợ Notification');
        return;
      }
      if (Notification.permission !== 'granted') {
        const p = await Notification.requestPermission();
        if (p !== 'granted') { append('User denied notification'); return; }
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: u8(VAPID_PUBLIC),
      });
      const rawKey = (key: string) =>
        btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey(key) as ArrayBuffer) as unknown as number[]));
      const p256dh = rawKey('p256dh');
      const auth = rawKey('auth');

      const { data: u } = await supabase.auth.getUser();
      await supabase.from('push_subscriptions').upsert(
        { user_id: u.user?.id, endpoint: sub.endpoint, p256dh, auth },
        { onConflict: 'endpoint' }
      );

      append('Subscribed: ' + sub.endpoint.slice(0, 38) + '…');
      refresh();
    } catch (e: any) {
      append('subscribe error: ' + (e?.message || e));
    }
  };

  const doUnsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      append('Unsubscribed');
      refresh();
    } catch (e: any) {
      append('unsubscribe error: ' + (e?.message || e));
    }
  };

  const testPushEmail = async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) { append('Chưa đăng nhập'); return; }

      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/send-notifications`;
      const res = await fetch(url!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }, // dùng no-verify-jwt
        body: JSON.stringify({ mode: 'test', user_id: userId }),
      });
      const txt = await res.text();
      append('TEST response: ' + txt);
    } catch (e: any) {
      append('test error: ' + (e?.message || e));
    }
  };

  return (
    <div className="container py-4">
      <h4>Debug Push/Email</h4>
      <ul className="small">
        <li>Service Worker: <b>{info.sw}</b></li>
        <li>Notification permission: <b>{info.permission}</b></li>
        <li>Subscribed: <b>{String(info.subscribed)}</b></li>
        <li>Endpoint: <code>{info.endpoint?.slice(0, 45)}...</code></li>
        <li>VAPID public length: <b>{info.vapidLen}</b></li>
      </ul>

      <div className="d-flex gap-2 mb-3">
        <button className="btn btn-outline-primary btn-sm" onClick={refresh}>Refresh</button>
        <button className="btn btn-success btn-sm" onClick={doSubscribe}>Đăng ký Push</button>
        <button className="btn btn-outline-secondary btn-sm" onClick={doUnsubscribe}>Hủy Push</button>
        <button className="btn btn-warning btn-sm" onClick={testPushEmail}>Test Push + Email</button>
      </div>

      <pre style={{whiteSpace:'pre-wrap', background:'#f8f9fa', padding:12, borderRadius:6, minHeight:150}}>{log}</pre>
    </div>
  );
}
