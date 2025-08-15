// app/debug/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

type Permission = 'default' | 'denied' | 'granted';

type Info = {
  sw: 'checking' | 'unsupported' | 'registered' | 'not-registered';
  permission: Permission;
  subscribed: boolean;
  endpoint?: string;
  vapidLen: number;
};

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

/** Convert base64url string -> Uint8Array (for pushManager.subscribe) */
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
  const [info, setInfo] = useState<Info>({
    sw: 'checking',
    permission: 'default',
    subscribed: false,
    vapidLen: VAPID_PUBLIC.length,
  });
  const [log, setLog] = useState<string>('');
  const say = (s: string) => setLog((x) => x + s + '\n');

  /** Refresh trạng thái SW/Permission/Subscription */
  const refresh = async () => {
    try {
      let sw: Info['sw'] = 'unsupported';
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration('/');
        sw = reg ? 'registered' : 'not-registered';
      }
      let subscribed = false;
      let endpoint: string | undefined;

      if ('serviceWorker' in navigator) {
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
      say('refresh error: ' + (e?.message || e));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  /** Đăng ký push và lưu endpoint vào Supabase */
  const doSubscribe = async () => {
    try {
      if (!('serviceWorker' in navigator)) return say('Thiết bị không hỗ trợ Service Worker');
      if (!('Notification' in window)) return say('Trình duyệt không hỗ trợ Notification');

      if (Notification.permission !== 'granted') {
        const p = await Notification.requestPermission();
        if (p !== 'granted') return say('User từ chối cấp quyền thông báo');
      }

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: u8(VAPID_PUBLIC),
      });

      const rawKey = (key: string) =>
        btoa(
          String.fromCharCode.apply(
            null,
            new Uint8Array(sub.getKey(key) as ArrayBuffer) as unknown as number[]
          )
        );
      const p256dh = rawKey('p256dh');
      const auth = rawKey('auth');

      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      if (!userId) return say('Chưa đăng nhập');

      const { error: upErr } = await supabase
        .from('push_subscriptions')
        .upsert(
          { user_id: userId, endpoint: sub.endpoint, p256dh, auth },
          { onConflict: 'endpoint' }
        );

      if (upErr) say('save sub error: ' + upErr.message);
      else say('Đăng ký & lưu endpoint: ' + sub.endpoint.slice(0, 55) + '…');

      refresh();
    } catch (e: any) {
      say('subscribe error: ' + (e?.message || e));
    }
  };

  /** Hủy subscription và xóa endpoint trong Supabase */
  const doUnsubscribe = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      say('Đã hủy đăng ký push');
      refresh();
    } catch (e: any) {
      say('unsubscribe error: ' + (e?.message || e));
    }
  };

  /** Gọi API nội bộ Next.js để tránh CORS, chế độ test: gửi push + email ngay */
  const testPushEmail = async () => {
    try {
      setLog('');
      say('Gọi /api/notify?mode=test ...');
      const res = await fetch('/api/notify?mode=test', { method: 'GET' });
      const json = await res.json();
      say('Kết quả: ' + JSON.stringify(json));
    } catch (e: any) {
      say('invoke error: ' + (e?.message || e));
    }
  };

  /** Quét scheduled ngay (giống cron) */
  const runScanNow = async () => {
    try {
      setLog('');
      say('Gọi /api/notify?mode=scan ...');
      const res = await fetch('/api/notify?mode=scan', { method: 'GET' });
      const json = await res.json();
      say('Kết quả: ' + JSON.stringify(json));
    } catch (e: any) {
      say('scan error: ' + (e?.message || e));
    }
  };

  return (
    <div className="container py-4">
      <h4>Debug Push/Email</h4>

      <ul className="small">
        <li>
          Service Worker: <b>{info.sw}</b>
        </li>
        <li>
          Notification permission: <b>{info.permission}</b>
        </li>
        <li>
          Subscribed: <b>{String(info.subscribed)}</b>
        </li>
        <li>
          Endpoint: <code>{info.endpoint ? info.endpoint.slice(0, 70) + '…' : '-'}</code>
        </li>
        <li>
          VAPID public length: <b>{info.vapidLen}</b>
        </li>
      </ul>

      <div className="d-flex flex-wrap gap-2 mb-3">
        <button className="btn btn-outline-primary btn-sm" onClick={refresh}>
          Refresh
        </button>
        <button className="btn btn-success btn-sm" onClick={doSubscribe}>
          Đăng ký Push
        </button>
        <button className="btn btn-outline-secondary btn-sm" onClick={doUnsubscribe}>
          Hủy Push
        </button>
        <button className="btn btn-warning btn-sm" onClick={testPushEmail}>
          Test Push + Email
        </button>
        <button className="btn btn-danger btn-sm" onClick={runScanNow}>
          Quét ca ngay (scheduled)
        </button>
      </div>

      <pre
        style={{
          whiteSpace: 'pre-wrap',
          background: '#f8f9fa',
          padding: 12,
          borderRadius: 6,
          minHeight: 150,
        }}
      >
        {log}
      </pre>
    </div>
  );
}
