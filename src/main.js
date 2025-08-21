// ========= Styles (Tailwind built by Vite) =========
import "./style.css";

// ========= Libs =========
import { createClient } from "@supabase/supabase-js";
// Nếu bạn đã có file onesignal.js từ trước, giữ lại import dưới.
// Nếu chưa, có thể tạm comment 3 dòng import và bỏ các tính năng push.
import {
  initPushForUser,
  requestPushPermissionAndSave,
  checkPushState,
} from "./onesignal.js";

// ========= Supabase client =========
// Yêu cầu bạn đã set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY trong Netlify
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

// ========= Beep in foreground =========
const alertAudio = new Audio("/sounds/beep.mp3");
alertAudio.preload = "auto";
let userInteracted = false;
window.addEventListener("pointerdown", () => { userInteracted = true; }, { once: true });
function tryBeep() {
  if (!userInteracted) return;
  alertAudio.currentTime = 0;
  alertAudio.play().catch(() => {});
  if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
}

// ========= Helpers =========
const $ = (id) => document.getElementById(id);

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}
function colorByRemain(remainMs) {
  const remainMin = remainMs / 60000;
  if (remainMin <= 0) return "border-red-500";
  if (remainMin <= 5) return "border-yellow-500";
  return "border-sky-500";
}
function minutesFromFormula(volume, dropsPerMl, rateDropPerMin) {
  // phút = (ml * giọt/ml) / (giọt/phút)
  if (!rateDropPerMin) return 0;
  return (Number(volume) * Number(dropsPerMl)) / Number(rateDropPerMin);
}

// ========= Auth UI =========
async function refreshAuthUI() {
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (user) {
    $("#btnGoogle").classList.add("hidden");
    $("#btnLogout").classList.remove("hidden");
    $("#authInfo").textContent = `Đăng nhập: ${user.email}`;
    // init OneSignal cho user
    try { await initPushForUser({ id: user.id }); } catch {}
  } else {
    $("#btnLogout").classList.add("hidden");
    $("#btnGoogle").classList.remove("hidden");
    $("#authInfo").textContent = "Chưa đăng nhập.";
  }
}
$("#btnGoogle").addEventListener("click", async () => {
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
});
$("#btnLogout").addEventListener("click", async () => {
  await supabase.auth.signOut();
  await refreshAuthUI();
});

supabase.auth.onAuthStateChange((_e, _s) => refreshAuthUI());
refreshAuthUI();

// ========= Push buttons =========
$("#btnEnablePush").addEventListener("click", async () => {
  const res = await requestPushPermissionAndSave();
  $("#pushState").textContent = res.ok ? res.message : `Lỗi: ${res.message}`;
});
$("#btnCheckPush").addEventListener("click", async () => {
  const res = await checkPushState();
  $("#pushState").textContent = res.ok
    ? `perm=${res.perm}, optedIn=${res.optedIn}, id=${res.subId || "-"}`
    : `Lỗi: ${res.message}`;
});

// ========= Create infusion =========
$("#createForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return alert("Hãy đăng nhập Google trước.");

  const patient_name = $("#patient_name").value.trim();
  const room = $("#room").value.trim();
  const bed = $("#bed").value.trim();
  const volume_ml = Number($("#volume_ml").value);
  const drop_per_ml = Number($("#drop_per_ml").value);
  const rate_drop_per_min = Number($("#rate_drop_per_min").value);
  const note = $("#note").value.trim();
  const email_notify = $("#email_notify").checked;
  const email_to = ($("#email_to").value || user.email || "").trim();

  if (!patient_name || !volume_ml || !drop_per_ml || !rate_drop_per_min) {
    return alert("Điền đầy đủ các trường bắt buộc.");
  }

  const minutes = minutesFromFormula(volume_ml, drop_per_ml, rate_drop_per_min);
  const start_time = new Date();
  const end_time = new Date(start_time.getTime() + minutes * 60000);

  const { error } = await supabase.from("infusions").insert({
    user_id: user.id,
    patient_name, room, bed,
    volume_ml, drop_per_ml, rate_drop_per_min,
    start_time: start_time.toISOString(),
    end_time: end_time.toISOString(),
    note,
    email_notify,
    email_to: email_notify ? email_to : null,
    status: "running",
  });

  $("#createMsg").textContent = error ? `Lỗi: ${error.message}` : "Đã bắt đầu truyền.";
  if (!error) {
    $("#createForm").reset();
    await loadRunning();
  }
});

// ========= Lists (running & history) =========
let runningCache = [];

function renderRunning(list) {
  const wrap = $("#runningList");
  wrap.innerHTML = "";
  for (const it of list) {
    const remain = Math.max(0, new Date(it.end_time) - Date.now());
    const card = document.createElement("div");
    card.className = `card border-2 ${colorByRemain(remain)}`;
    card.dataset.id = it.id;
    card.innerHTML = `
      <div class="flex justify-between">
        <div>
          <div class="font-semibold">${it.patient_name}</div>
          <div class="text-sm text-gray-600">${it.room ?? ""}/${it.bed ?? ""}</div>
        </div>
        <div class="tag">Kết thúc: ${new Date(it.end_time).toLocaleTimeString("vi-VN")}</div>
      </div>
      <div class="mt-2 text-3xl font-black tabular-nums" id="t-${it.id}">${fmt(remain)}</div>
    `;
    wrap.appendChild(card);
  }
}

function renderHistory(list) {
  const wrap = $("#historyList");
  wrap.innerHTML = "";
  for (const it of list) {
    const item = document.createElement("div");
    item.className = "card border";
    item.innerHTML = `
      <div class="flex justify-between">
        <div>
          <div class="font-semibold">${it.patient_name}</div>
          <div class="text-sm text-gray-600">${it.room ?? ""}/${it.bed ?? ""}</div>
        </div>
        <div class="tag">Kết thúc: ${new Date(it.end_time).toLocaleString("vi-VN")}</div>
      </div>
      <div class="text-sm mt-2">Push: ${it.push_sent ? "✓" : "—"} · Email: ${it.email_sent ? "✓" : "—"}</div>
    `;
    wrap.appendChild(item);
  }
}

async function loadRunning() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { data, error } = await supabase
    .from("infusions")
    .select("*")
    .eq("user_id", auth.user.id)
    .eq("status", "running")
    .order("end_time", { ascending: true });
  if (error) return console.error(error);
  runningCache = data || [];
  renderRunning(runningCache);
}

async function loadHistory() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  // Nếu bạn có view v_history thì thay bằng from("v_history")
  const { data, error } = await supabase
    .from("infusions")
    .select("id,patient_name,room,bed,end_time,push_sent,email_sent,status")
    .eq("user_id", auth.user.id)
    .eq("status", "completed")
    .order("end_time", { ascending: false })
    .limit(100);
  if (error) return console.error(error);
  renderHistory(data || []);
}

$("#btnReloadRunning").addEventListener("click", loadRunning);
$("#btnReloadHistory").addEventListener("click", loadHistory);

$("#btnClearHistory").addEventListener("click", async () => {
  if (!confirm("Xoá toàn bộ lịch sử của bạn?")) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return alert("Bạn chưa đăng nhập.");
  const { error } = await supabase
    .from("infusions")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("status", "completed");
  if (error) alert("Lỗi xoá: " + error.message);
  else loadHistory();
});

// ========= Countdown tick =========
setInterval(() => {
  for (const it of runningCache) {
    const el = document.getElementById(`t-${it.id}`);
    if (!el) continue;
    const end = new Date(it.end_time).getTime();
    const now = Date.now();
    const remain = Math.max(0, end - now);
    const prev = Number(el.dataset.prev || "999999");
    if (prev > 0 && remain === 0) tryBeep();
    el.dataset.prev = String(remain);
    el.textContent = fmt(remain);
    const card = el.closest(".card");
    if (card) card.className = `card border-2 ${colorByRemain(remain)}`;
  }
}, 1000);

// ========= First load =========
loadRunning();
loadHistory();

// ========= Minimal Tailwind components (via CSS classes) =========
// (Các class .input, .btn-primary, .btn-outline, .card, .tag đã định nghĩa trong src/style.css)
