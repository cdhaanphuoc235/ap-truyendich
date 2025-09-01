import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

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
          // Khuyến nghị: thay bằng PNG thật 192/512 cho Android.
          // SVG vẫn để tương thích desktop; Android ưa PNG.
          {
            src: "/logo.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ],
        shortcuts: [
          { name: "Tạo ca mới", url: "/", description: "Mở nhanh form tạo ca" }
        ]
      },
      workbox: {
        // Precache build assets + index.html => App Shell offline
        globPatterns: ["**/*.{js,css,html,svg,png,mp3}"],
        navigateFallback: "/index.html",
        navigationPreload: true,
        runtimeCaching: [
          // Pages (documents)
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "pages",
              expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 } // 7d
            }
          },
          // Static assets
          {
            urlPattern: ({ request }) =>
              ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } // 30d
            }
          },
          // Images / media (logo, alarm)
          {
            urlPattern: ({ request }) =>
              ["image", "audio"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "media",
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 }
            }
          }
          // Không cache API Supabase (có Auth header + RLS).
        ]
      },
      devOptions: { enabled: true }
    })
  ],
  server: { port: 5173, host: true }
});
