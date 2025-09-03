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
          { src: "/logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ],
        shortcuts: [{ name: "Tạo ca mới", url: "/", description: "Mở nhanh form tạo ca" }]
      },
      workbox: {
        navigateFallback: "/index.html",
        navigationPreload: true
        // Không đặt globPatterns -> plugin tự xử lý precache assets
      },
      devOptions: { enabled: true }
    })
  ],
  server: { port: 5173, host: true }
});
