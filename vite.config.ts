import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Lưu ý: Chúng ta đảm bảo SW không can thiệp cross-origin đến Supabase
// để tránh mọi rủi ro mất header Authorization/apikey trong luồng OAuth.

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg", "alarm.mp3"],
      manifest: {
        name: "ap-truyendich",
        short_name: "Truyền dịch",
        description: "PWA hỗ trợ điều dưỡng tính & theo dõi thời gian truyền dịch.",
        theme_color: "#0EA5E9",
        background_color: "#F8FAFC",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" },
        ],
        shortcuts: [{ name: "Tạo ca mới", url: "/", description: "Mở nhanh form tạo ca" }],
      },
      workbox: {
        navigateFallback: "/index.html",
        // Đừng fallback các callback nội bộ (nếu có)
        navigateFallbackDenylist: [/^\/auth\/callback/],
        navigationPreload: true,
        runtimeCaching: [
          // 1) CHẶN SW đụng vào mọi call Supabase AUTH (cross-origin)
          {
            urlPattern: /^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co\/auth\/.*/i,
            handler: "NetworkOnly",
            options: { cacheName: "supabase-auth" },
          },
          // 2) CHẶN SW đụng vào REST (PostgREST)
          {
            urlPattern: /^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co\/rest\/.*/i,
            handler: "NetworkOnly",
            options: { cacheName: "supabase-rest" },
          },
          // 3) CHẶN SW đụng vào Storage
          {
            urlPattern: /^https:\/\/[a-zA-Z0-9.-]+\.supabase\.co\/storage\/.*/i,
            handler: "NetworkOnly",
            options: { cacheName: "supabase-storage" },
          },
          // 4) Navigation/documents của chính app (same-origin)
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: { cacheName: "pages", expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 } },
          },
          // 5) Static assets same-origin
          {
            urlPattern: ({ request }) => ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "assets", expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          // 6) Media same-origin
          {
            urlPattern: ({ request }) => ["image", "audio", "font"].includes(request.destination),
            handler: "CacheFirst",
            options: { cacheName: "media", expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: { port: 5173, host: true },
});
