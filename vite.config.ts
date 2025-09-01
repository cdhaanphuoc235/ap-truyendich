import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["logo.svg"],
      manifest: {
        name: "ap-truyendich",
        short_name: "Truyền dịch",
        description:
          "PWA hỗ trợ điều dưỡng tính & theo dõi thời gian truyền dịch.",
        theme_color: "#0EA5E9",
        background_color: "#F8FAFC",
        display: "standalone",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "/logo.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          }
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,mp3}"],
        runtimeCaching: [
          {
            // SPA pages
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: { cacheName: "pages" },
          },
          {
            // static assets
            urlPattern: ({ request }) =>
              ["style", "script", "worker"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "assets" },
          },
        ],
      },
      devOptions: { enabled: true },
    }),
  ],
  server: { port: 5173, host: true },
});
