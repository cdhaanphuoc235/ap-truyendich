self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }
  const title = payload.title || 'AP - Truyền dịch';
  const body  = payload.body || 'Đã đến giờ kết thúc ca truyền.';
  const data  = payload.data || { url: '/app' };
  event.waitUntil(self.registration.showNotification(title, {
    body, data,
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    requireInteraction: true,
    timestamp: Date.now(),
    vibrate: [200,100,200],
    actions: [{ action: 'open', title: 'Mở ứng dụng' }]
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/app';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) { client.navigate(url); return client.focus(); }
      return self.clients.openWindow(url);
    })
  );
});
