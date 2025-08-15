self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = {}; }

  const title = payload.title || 'AP - Truyền dịch';
  const body  = payload.body  || 'Đã đến giờ kết thúc ca truyền.';
  const data  = payload.data  || { url: '/app' };

  // Gắn tag để “gộp” các thông báo cùng ca, và bật renotify để báo lại nếu có
  const tag = payload.tag || 'ap-truyendich-infusion';
  const options = {
    body,
    data,
    tag,
    renotify: true,
    // Lưu ý: requireInteraction phần lớn bị bỏ qua trên mobile
    requireInteraction: false,
    // Rung mạnh hơn (~2.2 giây)
    vibrate: [300,100,300,100,600,100,600],
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    timestamp: Date.now(),
    actions: [{ action: 'open', title: 'Mở ứng dụng' }]
  };

  event.waitUntil(self.registration.showNotification(title, options));
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
