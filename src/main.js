// ========= Styles (Tailwind built by Vite) =========
import "./style.css";

// ========= Env validation =========
const VITE_URL = import.meta.env.VITE_SUPABASE_URL;
const VITE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

function fatal(msg) {
  console.error(msg);
  const root = document.querySelector("main") || document.body;
  const bar = document.createElement("div");
  bar.className = "p-3 rounded-xl bg-red-100 text-red-700 border border-red-300 mb-3";
  bar.textContent = msg;
  root.prepend(bar);
}

if (!VITE_URL || !VITE_ANON) {
  fatal("Thiếu ENV: VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY (Netlify). App sẽ không hoạt động.");
}

// ========= Libs =========
import { createClient } from "@supabase/supabase-js";

let supabase = null;
if (VITE_URL && VITE_ANON) {
  supabase = createClient(VITE_URL, VITE_ANON);
}

// (Có thể comment nếu bạn chưa cập nhật onesignal.js)
let initPushForUser, requestPushPermissionAndSave, checkPushState;
try {
  const mod = await import("./onesignal.js");
  initPushForUser = mod.initPushForUser;
  requestPushPermissionAndSave = mod.requestPushPermissionAndSave;
  checkPushState = mod.checkPushState;
} catch (e) {
  console.warn("OneSignal module not loaded:", e?.message || e);
}

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
function on(el, ev, fn){ if (el) el.addEventListener(ev, fn); }

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
  if (!rateDropPerMin) return 0;
  return (Number(volume) * Number(dropsPerMl)) / Number(rateDropPerMin);
}

// ========= Auth UI =========
async function refreshAuthUI() {
  if (!supabase) return;
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  const btnGoogle = $("#btnGoogle");
  const btnLogout = $("#btnLogout");
  const info = $("#authInfo");
  if (user) {
    btnGoogle && btnGoogle.classList.add("hidden");
    btnLogout && btnLogout.classList.remove("hidden");
    info && (info.textContent = `Đăng nhập: ${user.email}`);
    try { initPushForUser && (await initPushForUser({ id: user.id })); } catch {}
  } else {
    btnLogout && btnLogout.classList.add("hidden");
    btnGoogle && btnGoogle.classList.remove("hidden");
    info && (info.textContent = "Chưa đăng nhập.");
  }
}

on($("#btnGoogle"), "click", async () => {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
});
on($("#btnLogout"), "click", async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
  await refreshAuthUI();
});

supabase && supabase.auth.onAuthStateChange((_e, _s) => refreshAuthUI());
refreshAuthUI();

// ========= Push buttons =========
on($("#btnEnablePush"), "click", async () => {
  if (!requestPushPermissionAndSave) return fatal("Push SDK chưa sẵn sàng.");
  const res = await requestPushPermissionAndSave();
  const p = $("#pushState"); if (p) p.textContent = res.ok ? res.message : `Lỗi: ${res.message}`;
});
on($("#btnCheckPush"), "click", async () => {
  if (!checkPushState) return fatal("Push SDK chưa sẵn sàng.");
  const res = await checkPushState();
  const p = $("#pushState"); if (p) p.textContent = res.ok
      ? `perm=${res.perm}, optedIn=${res.optedIn}, id=${res.subId || "-"}`
      : `Lỗi: ${res.message}`;
});

// ========= Create infusion =========
on($("#createForm"), "submit", async (e) => {
  e.preventDefault();
  if (!supabase) return fatal("Supabase client chưa sẵn sàng (thiếu ENV).");

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return alert("Hãy đăng nhập Google trước.");

  const patient_name = $("#patient_name")?.value.trim();
  const room = $("#room")?.value.trim();
  const bed = $("#bed")?.value.trim();
  const volume_ml = Number($("#volume_ml")?.value);
  const drop_per_ml = Number($("#drop_per_ml")?.value);
  const rate_drop_per_min = Number($("#rate_drop_per_min")?.value);
  const note = $("#note")?.value.trim();
  const email_notify = $("#email_notify")?.checked;
  const email_to = (($("#email_to")?.value || user.email || "").trim());

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

  const msgEl = $("#createMsg");
  if (msgEl) msgEl.textContent = error ? `Lỗi: ${error.message}` : "Đã bắt đầu truyền.";
  if (!error) {
    $("#createForm")?.reset();
    await loadRunning();
  }
});

// ========= Lists (running & history) =========
let runningCache = [];

function renderRunning(list) {
  const wrap = $("#runningList");
  if (!wrap) return;
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
  if (!wrap) return;
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
  if (!supabase) return;
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
  if (!supabase) return;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
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

on($("#btnReloadRunning"), "click", loadRunning);
on($("#btnReloadHistory"), "click", loadHistory);

on($("#btnClearHistory"), "click", async () => {
  if (!supabase) return;
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
