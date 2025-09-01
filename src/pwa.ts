import { registerSW } from "virtual:pwa-register";

export function initPWA() {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      // Có phiên bản mới -> reload nhẹ
      // (Sẽ thay bằng toast UI ở giai đoạn sau)
      console.log("PWA: new content available, reloading…");
      window.location.reload();
    },
    onOfflineReady() {
      console.log("PWA: offline ready");
    },
  });
}
