'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function PushToggle({ userId }: { userId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(ok);
    if (!ok) return;
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => setEnabled(!!sub));
  }, []);

  async function subscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!)
      });
      // Lưu lên Supabase (có user_id để thỏa RLS)
      const { error } = await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: arrayBufferToBase64(sub.getKey('p256dh')!),
        auth: arrayBufferToBase64(sub.getKey('auth')!)
      }, { onConflict: 'endpoint' });
      if (error) throw error;
      setEnabled(true);
      alert('Đã bật thông báo.');
    } catch (e: any) {
      alert('Không bật được thông báo: ' + e.message);
    }
  }

  async function unsubscribe() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
    setEnabled(false);
  }

  if (!supported) {
    return <div className="alert alert-warning">Thiết bị không hỗ trợ Web Push.</div>;
  }

  return (
    <div className="alert alert-info d-flex align-items-center justify-content-between">
      <div><strong>Thông báo:</strong> {enabled ? 'ĐÃ BẬT' : 'CHƯA BẬT'}</div>
      {!enabled ? <button className="btn btn-success btn-sm" onClick={subscribe}>Bật</button>
                : <button className="btn btn-outline-danger btn-sm" onClick={unsubscribe}>Tắt</button>}
    </div>
  );
}

function urlBase64ToUint8Array(base64String:string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const b64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const outputArray = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) outputArray[i] = raw.charCodeAt(i);
  return outputArray;
}
function arrayBufferToBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf); let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
