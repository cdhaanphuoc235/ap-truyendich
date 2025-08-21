// src/onesignal.js — SDK v16 chuẩn, đợi init trước khi gọi API

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

function waitSdkReady() {
  return new Promise((resolve) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        if (!OneSignal.initialized) {
          await OneSignal.init({
            appId: APP_ID,
            safari_web_id: undefined,     // nếu có
            allowLocalhostAsSecureOrigin: true, // tiện dev
          });
try {
  OneSignal.Notifications.addEventListener("notificationDisplay", () => {
    // Phát beep nếu user đang ở trong app
    try {
      const a = new Audio("/sounds/beep.mp3");
      a.play().catch(()=>{});
    } catch {}
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
  });
} catch {}
        }
        resolve(OneSignal);
      } catch (e) {
        console.error("OneSignal init error", e);
        resolve(null);
      }
    });
  });
}

/** Gán userId vào OneSignal (để cron target theo external_id) */
export async function initPushForUser(user) {
  const OneSignal = await waitSdkReady();
  if (!OneSignal || !user?.id) return { ok:false, message:"SDK chưa sẵn sàng" };
  try {
    await OneSignal.login(user.id); // v16
    return { ok:true };
  } catch (e) {
    console.error(e);
    return { ok:false, message:String(e?.message || e) };
  }
}

/** Xin quyền + subscribe, lưu playerId vào DB nếu muốn (tùy chọn) */
export async function requestPushPermissionAndSave(user) {
  const OneSignal = await waitSdkReady();
  if (!OneSignal) return { ok:false, message:"SDK chưa sẵn sàng" };
  try {
    const perm = await OneSignal.Notifications.requestPermission(); // 'granted' | 'denied' | 'default'
    if (perm !== 'granted') return { ok:false, message:"Bạn chưa cấp quyền thông báo" };

    // v16: get subscription id qua User.PushSubscription.getId()
    const subId = await OneSignal.User.PushSubscription.getId();
    // (Tùy chọn) ghi vào bảng push_subscriptions nếu cần
    // await supabase.from("push_subscriptions").insert({ user_id: user.id, onesignal_player_id: subId, platform: 'web' });

    return { ok:true, message:"Đã bật thông báo", subId };
  } catch (e) {
    console.error(e);
    return { ok:false, message:String(e?.message || e) };
  }
}

export async function checkPushState() {
  const OneSignal = await waitSdkReady();
  if (!OneSignal) return { ok:false, message:"SDK chưa sẵn sàng" };
  try {
    const perm = await OneSignal.Notifications.getPermissionStatus(); // 'granted' | ...
    let subId = null;
    try { subId = await OneSignal.User.PushSubscription.getId(); } catch {}
    const optedIn = !!subId;
    return { ok:true, perm: perm === 'granted', optedIn, subId, message: "" };
  } catch (e) {
    console.error(e);
    return { ok:false, message:String(e?.message || e) };
  }
}
