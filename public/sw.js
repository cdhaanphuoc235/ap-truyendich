// public/sw.js — OneSignal + cache GET + pre-cache icon/sound
importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

const CACHE_NAME = "ap-truyendich-v2";
const ASSETS_TO_CACHE = [
  "/",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/sounds/beep.mp3"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_TO_CACHE)).catch(()=>{})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

// Chỉ cache GET (tránh crash khi POST)
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then(cached => {
      return cached || fetch(req).then(res => {
        try {
          const copy = res.clone();
          if (req.url.startsWith(self.origin) && copy.ok) {
            caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(()=>{});
          }
        } catch {}
        return res;
      });
    })
  );
});
