'use client';

import { useEffect, useState } from 'react';

type Msg = { title: string; body: string; url?: string };

function playBeep() {
  try {
    const AC = (window.AudioContext || (window as any).webkitAudioContext);
    if (!AC) return;
    const ctx = new AC();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.value = 880;
    o.connect(g);
    g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    o.start();
    setTimeout(() => {
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.stop(ctx.currentTime + 0.35);
      ctx.close();
    }, 300);
  } catch {}
}

export default function NotifyClient() {
  const [toast, setToast] = useState<Msg | null>(null);

  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const m = e.data || {};
      if (m.type === 'INFUSION_ALERT') {
        const t = { title: m.title || 'Thông báo', body: m.body || '' };
        setToast(t);
        if (localStorage.getItem('ap_sound_enabled') === '1') {
          playBeep();
        }
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMsg as any);
    return () => navigator.serviceWorker?.removeEventListener('message', onMsg as any);
  }, []);

  if (!toast) return null;

  return (
    <div
      className="position-fixed bottom-0 end-0 p-3"
      style={{ zIndex: 1080 }}
      onClick={() => setToast(null)}
    >
      <div className="toast show" role="alert" aria-live="assertive" aria-atomic="true">
        <div className="toast-header">
          <strong className="me-auto">{toast.title}</strong>
          <small>vừa xong</small>
          <button type="button" className="btn-close ms-2 mb-1" aria-label="Close" onClick={() => setToast(null)}></button>
        </div>
        <div className="toast-body">
          {toast.body}
          <div className="mt-2 small text-muted">(chạm để đóng)</div>
        </div>
      </div>
    </div>
  );
}
