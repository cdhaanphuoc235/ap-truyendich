import { supabase } from "./supabase.js";

const APP_ID = import.meta.env.VITE_ONESIGNAL_APP_ID;

/**
 * Khởi tạo OneSignal sau khi user đã đăng nhập.
 * - Đăng nhập OneSignal bằng externalId = user.id (không bật identity verification thì OK).
 * - Xin quyền, lấy Subscription ID, lưu vào Supabase (push_subscriptions).
 */
export async function initPushForUser(user) {
  if (!APP_ID) {
    console.warn("Missing VITE_ONESIGNAL_APP_ID");
    return { ok: false, message: "Thiếu OneSignal App ID" };
  }
  if (!user) return { ok: false, message: "Chưa có user" };

  // Tạo deferred queue theo chuẩn v16
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  window.OneSignalDeferred.push(async function (OneSignal) {
    // Init SDK
    await OneSignal.init({
      appId: APP_ID,
      allowLocalhostAsSecureOrigin: true, // cho dev localhost
      notifyButton: { enable: false },
      // Nếu bạn muốn custom SW path/scope, có thể dùng:
      // serviceWorkerParam: { scope: "/push/onesignal/" },
      // serviceWorkerPath: "/push/onesignal/OneSignalSDKWorker.js",
    });

    // Gắn externalId = user.id để thống nhất danh tính đa thiết bị
    try { await OneSignal.login(user.id); } catch (e) { console.debug("login skip:", e?.message); }

    // Event thay đổi subscription => lưu DB
    OneSignal.User.PushSubscription.addEventListener("change", async (ev) => {
      try {
        const subId = await OneSignal.User.PushSubscription.getId();
        const optedIn = await OneSignal.User.PushSubscription.optedIn;
        if (!optedIn || !subId) return;

        await saveSubscriptionToDB(user.id, subId, "web");
        console.log("Saved OneSignal subId:", subId);
      } catch (e) {
        console.warn("Save subscription failed:", e?.message || e);
      }
    });
  });

  return { ok: true };
}

export async function requestPushPermissionAndSave(user) {
  if (!user) return { ok: false, message: "Chưa đăng nhập" };
  const OneSignal = window.OneSignal || window.OneSignalDeferred;
  if (!OneSignal) return { ok: false, message: "OneSignal chưa sẵn sàng" };

  // Gọi theo v16
  try {
    const permission = await window.OneSignal.Notifications.requestPermission();
    // Nếu được cấp, lấy ID và lưu
    const subId = await window.OneSignal.User.PushSubscription.getId();
    const optedIn = await window.OneSignal.User.PushSubscription.optedIn;
    if (permission === "granted" && optedIn && subId) {
      await saveSubscriptionToDB(user.id, subId, "web");
      return { ok: true, message: "Đã bật thông báo.", subId };
    } else {
      return { ok: false, message: "Người dùng chưa cho phép hoặc chưa có Subscription ID." };
    }
  } catch (e) {
    return { ok: false, message: e?.message || String(e) };
  }
}

export async function checkPushState() {
  try {
    const perm = await window.OneSignal.Notifications.permission; // boolean theo v16 docs
    const subId = await window.OneSignal.User.PushSubscription.getId();
    const optedIn = await window.OneSignal.User.PushSubscription.optedIn;
    return { ok: true, perm, optedIn, subId };
  } catch (e) {
    return { ok: false, message: e?.message || String(e) };
  }
}

async function saveSubscriptionToDB(user_id, onesignal_player_id, platform) {
  // upsert để tránh trùng unique (user_id, onesignal_player_id)
  const { error } = await supabase
    .from("push_subscriptions")
    .upsert({ user_id, onesignal_player_id, platform }, { onConflict: "user_id,onesignal_player_id" });
  if (error) throw error;
}
