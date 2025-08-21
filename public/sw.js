importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "SKIP_WAITING") self.skipWaiting();
});

const CACHE_NAME = "ap-truyendich-v3";
const ASSETS = ["/","/icons/icon-192.png","/icons/icon-512.png","/sounds/beep.mp3"];

self.addEventListener("install", (evt) => {
  evt.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)).catch(()=>{}).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", (evt) => {
  evt.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});
self.addEventListener("fetch", (evt) => {
  const req = evt.request;
  if (req.method !== "GET") return;
  evt.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      try {
        const copy = res.clone();
        if (copy.ok && new URL(req.url).origin === self.origin) {
          caches.open(CACHE_NAME).then(c => c.put(req, copy)).catch(()=>{});
        }
      } catch {}
      return res;
    }))
  );
});
