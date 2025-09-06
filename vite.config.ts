// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: [
        "favicon.svg",
        "monicaLogo.png",
        "icons/icon-192x192.png",
        "icons/icon-512x512.png",
        "icons/icon-512x512-maskable.png",
        "alarm.mp3"
      ],
      manifest: {
        name: "Truyen dich",
        short_name: "Truyen dich",
        description:
          "PWA hỗ trợ điều dưỡng tính & theo dõi thời gian truyền dịch.",
        theme_color: "#0EA5E9",
        background_color: "#0EA5E9",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "/icons/icon-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        // Dùng app-shell khi offline
        navigateFallback: "/index.html",
        // Giữ glob đơn giản, tránh cảnh báo thừa
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest,wasm,mp3}"],
        // Không dùng navigationPreload để khỏi yêu cầu cấu hình đặc biệt
        navigationPreload: false,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          // 1) Auth của Supabase => luôn đi mạng, không cache
          {
            urlPattern: ({ url }) =>
              url.origin.includes(".supabase.co") &&
              url.pathname.startsWith("/auth/"),
            handler: "NetworkOnly",
            method: "GET"
          },
          {
            urlPattern: ({ url }) =>
              url.origin.includes(".supabase.co") &&
              url.pathname.startsWith("/auth/"),
            handler: "NetworkOnly",
            method: "POST"
          },
          // 2) Supabase API khác: ưu tiên mạng, có cache dự phòng ngắn
          {
            urlPattern: ({ url }) => url.origin.includes(".supabase.co"),
            handler: "NetworkFirst",
            options: {
              cacheName: "supabase-api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          // 3) Ảnh tĩnh
          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 64, maxAgeSeconds: 7 * 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  build: {
    outDir: "dist",
    sourcemap: false
  }
});
