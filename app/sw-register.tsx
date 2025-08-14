'use client';

import { useEffect } from 'react';

export default function SwRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // Đăng ký sw.js ở gốc site
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => {
        console.log('[SW] registered', reg.scope);
      })
      .catch(err => {
        console.error('[SW] register failed', err);
      });
  }, []);
  return null;
}
