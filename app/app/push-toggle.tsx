'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

type Props = { userId: string };

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '';

export default function PushToggle({ userId }: Props) {
  const supabase = getSupabase();
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const ok = 'serviceWorker' in navigator && 'PushManager' in window;
    setSupported(ok);
    setSoundEnabled(localStorage.getItem('ap_sound_enabled') === '1');
    // kiểm tra nhanh đã sub chưa
    (async () => {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setEnabled(!!sub);
      } catch {}
    })();
  }, []);

  async function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  }

  const enablePush = async () => {
    setBusy(true);
    try {
      if (Notification.permission !== 'granted') {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') throw new Error('Bạn đã từ chối quyền thông báo.');
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: await urlBase64ToUint8Array(VAPID_PUBLIC),
      });

      // lưu subscription lên Supabase
      const { endpoint } = sub;
      const rawKey = (key: string) => btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey(key) as ArrayBuffer) as unknown as number[]));
      const p256dh = rawKey('p256dh');
      const auth = rawKey('auth');

      await supabase.from('push_subscriptions').upsert(
        { user_id: userId, endpoint, p256dh, auth },
        { onConflict: 'endpoint' }
      );

      setEnabled(true);
    } catch (e: any) {
      alert(e?.message || e);
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
        await sub.unsubscribe();
      }
      setEnabled(false);
    } finally {
      setBusy(false);
    }
  };

  const toggleSound = async (on: boolean) => {
    setSoundEnabled(on);
    localStorage.setItem('ap_sound_enabled', on ? '1' : '0');
    // Khởi tạo AudioContext sau thao tác người dùng để lần sau có thể phát âm thanh
    if (on) {
      try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        await ctx.resume();
        ctx.close();
      } catch {}
    }
  };

  if (!supported) return null;

  return (
    <div className="card mt-2">
      <div className="card-body d-flex flex-wrap align-items-center gap-3">
        <div className="me-auto">
          <strong>Thông báo:</strong> {enabled ? <span className="text-success">ĐÃ BẬT</span> : <span className="text-danger">ĐANG TẮT</span>}
        </div>

        {!enabled ? (
          <button className="btn btn-success btn-sm" onClick={enablePush} disabled={busy}>Bật</button>
        ) : (
          <button className="btn btn-outline-secondary btn-sm" onClick={disablePush} disabled={busy}>Tắt</button>
        )}

        <div className="form-check">
          <input id="ap-sound" className="form-check-input" type="checkbox"
                 checked={soundEnabled} onChange={e => toggleSound(e.target.checked)} />
          <label htmlFor="ap-sound" className="form-check-label">
            Âm thanh khi app đang mở
          </label>
        </div>
      </div>
    </div>
  );
}
