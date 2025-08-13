'use client';
import { useEffect, useState } from 'react';

let deferredPrompt: any = null;

export default function InstallPrompt() {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();           // chặn UI mặc định của trình duyệt
      deferredPrompt = e;           // giữ lại event để gọi sau
      setCanInstall(true);          // hiện nút
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const onInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    // outcome: 'accepted' | 'dismissed'
    deferredPrompt = null;
    setCanInstall(false);
  };

  // Nếu app đã cài, Chrome sẽ không bắn beforeinstallprompt nữa → ẩn nút
  if (!canInstall) return null;

  return (
    <div className="alert alert-success d-flex align-items-center justify-content-between mt-3">
      <div><strong>Cài ứng dụng</strong> để nhận thông báo ổn định hơn.</div>
      <button className="btn btn-success btn-sm" onClick={onInstall}>Cài đặt</button>
    </div>
  );
}
