/* public/sw.js - Push & notification handler */

self.addEventListener('install', (e) => {
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  clients.claim();
});

/** Utils */
function parsePushData(event) {
  try {
    if (!event.data) return {};
    const txt = event.data.text();
    try { return JSON.parse(txt); } catch { return { body: txt }; }
  } catch { return {}; }
}

async function notifyClients(msg) {
  const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const c of all) c.postMessage(msg);
}

/** Handle Push -> show OS notification + message to pages (for in-app toast/sound) */
self.addEventListener('push', (event) => {
  const payload = parsePushData(event) || {};
  const title = payload.title || 'Thông báo';
  const body  = payload.body  || 'Đã đến giờ kết thúc ca truyền.';
  const url   = (payload.data && payload.data.url) || '/';

  const options = {
    body,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    vibrate: [200, 100, 200, 100, 300],
    tag: 'infusion-alert',
    renotify: true,
    requireInteraction: true, // giữ notification trên màn hình tới khi người dùng tương tác
    timestamp: Date.now(),
    data: { url }
  };

  event.waitUntil((async () => {
    await self.registration.showNotification(title, options);
    // Báo cho các tab đang mở để hiện toast + phát âm thanh
    await notifyClients({ type: 'INFUSION_ALERT', title, body, url });
  })());
});

/** Click vào notification -> mở/đưa vào focus trang app */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification && event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).pathname === url || new URL(c.url).pathname === '/') {
        c.focus();
        return;
      }
    }
    await clients.openWindow(url);
  })());
});

self.addEventListener('pushsubscriptionchange', () => {
  // Trình duyệt có thể xoay vòng endpoint; app sẽ yêu cầu đăng ký lại khi mở.
});
