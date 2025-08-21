const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

let osInitPromise = null;
export function oneSignalReady() {
  if (osInitPromise) return osInitPromise;
  osInitPromise = new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OS) => {
      try {
        if (!OS.initialized) {
          await OS.init({ appId: APP_ID, allowLocalhostAsSecureOrigin: true });
          try {
            OS.Notifications.addEventListener("notificationDisplay", () => {
              try { const a = new Audio("/sounds/beep.mp3"); a.play().catch(()=>{}); } catch {}
              if (navigator.vibrate) navigator.vibrate([100,50,100]);
            });
          } catch {}
        }
        resolve(OS);
      } catch (e) {
        console.warn("OneSignal.init error:", e?.message || e);
        resolve(null);
      }
    });
  });
  return osInitPromise;
}

export async function initPushForUser(user) {
  const OS = await oneSignalReady();
  if (!OS || !user?.id) return { ok:false, message:"SDK chưa sẵn sàng" };
  try { await OS.login(user.id); return { ok:true }; }
  catch(e){ return { ok:false, message:String(e?.message||e) }; }
}

export async function requestPushPermissionAndSave() {
  const OS = await oneSignalReady();
  if (!OS) return { ok:false, message:"SDK chưa sẵn sàng" };
  try {
    const perm = await OS.Notifications.requestPermission();
    if (perm !== 'granted') return { ok:false, message:"Bạn chưa cấp quyền" };
    const subId = await OS.User.PushSubscription.getId();
    return { ok:true, message:"Đã bật thông báo", subId };
  } catch(e){ return { ok:false, message:String(e?.message||e) }; }
}

export async function checkPushState() {
  const OS = await oneSignalReady();
  if (!OS) return { ok:false, message:"SDK chưa sẵn sàng" };
  try {
    const status = await OS.Notifications.getPermissionStatus();
    let subId = null; try { subId = await OS.User.PushSubscription.getId(); } catch {}
    return { ok:true, perm: status === 'granted', optedIn: !!subId, subId };
  } catch(e){ return { ok:false, message:String(e?.message||e) }; }
}
