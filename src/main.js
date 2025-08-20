import { supabase } from "./supabase.js";
import { initPushForUser, requestPushPermissionAndSave, checkPushState } from "./onesignal.js";

/* ---------- DOM refs ---------- */
const authBox = document.getElementById("authBox");
const appBox  = document.getElementById("appBox");

const emailEl    = document.getElementById("email");
const passEl     = document.getElementById("password");
const btnSignIn  = document.getElementById("btnSignIn");
const btnSignUp  = document.getElementById("btnSignUp");
const btnSignOut = document.getElementById("btnSignOut");
const authMsg    = document.getElementById("authMsg");

const userEmailLbl = document.getElementById("userEmail");

const patientEl = document.getElementById("patient_name");
const roomEl    = document.getElementById("room");
const bedEl     = document.getElementById("bed");
const volEl     = document.getElementById("volume_ml");
const dpmEl     = document.getElementById("drops_per_ml");
const rateEl    = document.getElementById("rate_dpm");
const notesEl   = document.getElementById("notes");
const wantsMail = document.getElementById("wants_email");
const emailToEl = document.getElementById("email_to");
const btnCreate = document.getElementById("btnCreate");
const createMsg = document.getElementById("createMsg");

const runningCount = document.getElementById("runningCount");
const runningList  = document.getElementById("runningList");
const btnReloadRunning = document.getElementById("btnReloadRunning");

const historyList  = document.getElementById("historyList");
const btnReloadHistory = document.getElementById("btnReloadHistory");

/* Push UI */
const btnEnablePush = document.getElementById("btnEnablePush");
const btnCheckPush  = document.getElementById("btnCheckPush");
const pushState     = document.getElementById("pushState");
const pushMsg       = document.getElementById("pushMsg");

/* SW update banner */
const swUpdateBanner = document.getElementById("swUpdateBanner");
const btnReload      = document.getElementById("btnReload");

let currentUser = null;
let countdownInterval = null;

/* ---------- PWA SW with update prompt ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").then(reg => {
      // Khi có SW mới chờ activate
      if (reg.waiting) showUpdateBanner(reg);
      reg.addEventListener("updatefound", () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener("statechange", () => {
          if (sw.state === "installed" && reg.waiting) showUpdateBanner(reg);
        });
      });
    }).catch(() => {});
  });
}
function showUpdateBanner(reg){
  swUpdateBanner.classList.remove("hidden");
  btnReload.onclick = () => {
    reg.waiting?.postMessage({ type: "SKIP_WAITING" });
    setTimeout(() => location.reload(), 250);
  };
}

/* ---------- Auth helpers ---------- */
function setAuthUI(loggedIn) {
  if (loggedIn) {
    authBox.classList.add("hidden");
    appBox.classList.remove("hidden");
    btnSignOut.classList.remove("hidden");
  } else {
    authBox.classList.remove("hidden");
    appBox.classList.add("hidden");
    btnSignOut.classList.add("hidden");
  }
}

async function getUser() {
  const { data } = await supabase.auth.getUser();
  currentUser = data.user ?? null;
  setAuthUI(!!currentUser);
  if (currentUser) userEmailLbl.textContent = currentUser.email || "-";
  return currentUser;
}

/* ---------- Sign In / Sign Up / Sign Out ---------- */
btnSignIn.onclick = async () => {
  authMsg.textContent = "Đang đăng nhập...";
  const email = emailEl.value.trim();
  const password = passEl.value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  authMsg.textContent = error ? `Lỗi: ${error.message}` : "Đăng nhập thành công.";
  if (!error) await afterLogin();
};
btnSignUp.onclick = async () => {
  authMsg.textContent = "Đang đăng ký...";
  const email = emailEl.value.trim();
  const password = passEl.value;
  const { error } = await supabase.auth.signUp({ email, password });
  authMsg.textContent = error ? `Lỗi: ${error.message}` : "Đăng ký thành công. Kiểm tra email xác nhận (nếu bật).";
};
btnSignOut.onclick = async () => {
  try { if (window.OneSignal?.logout) await window.OneSignal.logout(); } catch {}
  await supabase.auth.signOut();
  currentUser = null;
  setAuthUI(false);
  clearUI();
};

/* ---------- App logic ---------- */
function clearUI() {
  runningList.innerHTML = "";
  historyList.innerHTML = "";
  runningCount.textContent = "0";
  pushState.textContent = "Chưa đăng ký.";
  pushMsg.textContent = "";
  if (countdownInterval) { clearInterval(countdownInterval); countdownInterval = null; }
}

function pad2(n){ return String(n).padStart(2,"0"); }
function formatHHMMSS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}
function colorClassByRemaining(ms){
  if (ms <= 0) return "box-red";
  if (ms <= 5*60*1000) return "box-yellow";
  return "box-blue";
}
function clamp(v,min,max){ return Math.max(min, Math.min(max,v)); }

/* -------- RUNNING render with progress -------- */
function renderRunning(items) {
  runningList.innerHTML = "";
  items.forEach((it) => {
    const startMs = new Date(it.start_time).getTime();
    const endMs   = new Date(it.end_time).getTime();
    const div = document.createElement("div");
    div.className = "border rounded-xl p-3";
    div.dataset.start = String(startMs);
    div.dataset.end   = String(endMs);
    div.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0">
          <div class="font-semibold truncate">${escapeHTML(it.patient_name)}</div>
          <div class="text-xs text-slate-500">${escapeHTML(it.room || "")} ${escapeHTML(it.bed || "")}</div>
        </div>
        <div class="text-right text-xs text-slate-500">Kết thúc: ${new Date(it.end_time).toLocaleString()}</div>
      </div>
      <div class="mt-2 border rounded-xl p-3 text-center countdown-box">
        <div class="text-3xl font-bold countdown">--:--:--</div>
      </div>
      <div class="mt-2 progress-wrap"><div class="progress-bar" style="width:0%"></div></div>
    `;
    runningList.appendChild(div);
  });
  runningCount.textContent = String(items.length);
  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(updateCountdowns, 1000);
  updateCountdowns();
}

function updateCountdowns(){
  const cards = runningList.querySelectorAll("[data-end]");
  const now = Date.now();
  cards.forEach(card => {
    const start = Number(card.dataset.start);
    const end   = Number(card.dataset.end);
    const remain = Math.max(0, end - now);
    const total  = Math.max(1, end - start);
    const donePct = clamp(((now - start) / total) * 100, 0, 100);
    const box  = card.querySelector(".countdown-box");
    const label= card.querySelector(".countdown");
    const bar  = card.querySelector(".progress-bar");
    label.textContent = formatHHMMSS(remain);
    box.className = "mt-2 border rounded-xl p-3 text-center countdown-box " + colorClassByRemaining(remain);
    if (bar) bar.style.width = `${donePct}%`;
  });
}

/* -------- HISTORY (with logs) -------- */
function renderHistory(items){
  historyList.innerHTML = "";
  items.forEach((it) => {
    const row = document.createElement("div");
    row.className = "border rounded-xl p-3";
    const logs = (it.notifications || []).slice(0, 5); // hiển thị tối đa 5 log gần nhất
    row.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <div class="font-medium">${escapeHTML(it.patient_name)}</div>
          <div class="text-xs text-slate-500">Kết thúc: ${new Date(it.end_time).toLocaleString()}</div>
        </div>
        <span class="badge bg-slate-100 text-slate-700">${it.status}</span>
      </div>
      <details class="mt-2">
        <summary class="text-sm text-slate-600 cursor-pointer">Nhật ký thông báo (${logs.length})</summary>
        <div class="mt-2 grid gap-1">
          ${logs.map(l => `
            <div class="text-xs text-slate-600 border rounded px-2 py-1">
              <b>${escapeHTML(l.channel)}</b> — ${escapeHTML(l.status)} — ${new Date(l.created_at).toLocaleString()}
              ${l.detail ? `<div class="text-[11px] text-slate-500 mt-1">detail: ${escapeHTML(l.detail)}</div>` : ""}
            </div>
          `).join("")}
        </div>
      </details>
    `;
    historyList.appendChild(row);
  });
}

/* ---------- Data ops ---------- */
async function loadRunning() {
  const { data, error } = await supabase
    .from("infusions")
    .select("*")
    .eq("status", "running")
    .order("end_time", { ascending: true });
  if (error) console.error(error);
  renderRunning(data || []);
}
async function loadHistory() {
  // Dùng view v_history để kéo kèm notifications (Bước 2 đã tạo)
  const { data, error } = await supabase
    .from("v_history")
    .select("*")
    .order("end_time", { ascending: false })
    .limit(30);
  if (error) { console.error(error); return; }
  renderHistory(data || []);
}

btnReloadRunning.onclick = loadRunning;
btnReloadHistory.onclick = loadHistory;

btnCreate.onclick = async () => {
  createMsg.textContent = "Đang tạo ca...";
  if (!currentUser) { createMsg.textContent = "Vui lòng đăng nhập trước."; return; }
  try {
    const volume_ml    = Number(volEl.value);
    const drops_per_ml = Number(dpmEl.value);
    const rate_dpm     = Number(rateEl.value);
    if (!patientEl.value.trim() || !(volume_ml>0) || !(drops_per_ml>0) || !(rate_dpm>0)) {
      createMsg.textContent = "Thiếu hoặc sai dữ liệu bắt buộc.";
      return;
    }
    const start = new Date();
    const minutes = Math.ceil((volume_ml * drops_per_ml) / rate_dpm);
    const end = new Date(start.getTime() + minutes * 60 * 1000);

    const payload = {
      user_id: currentUser.id,
      patient_name: patientEl.value.trim(),
      room: roomEl.value.trim() || null,
      bed: bedEl.value.trim() || null,
      volume_ml, drops_per_ml, rate_dpm,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      notes: notesEl.value.trim() || null,
      wants_email: !!wantsMail.checked,
      email_to: emailToEl.value.trim() || null
    };
    const { error } = await supabase.from("infusions").insert(payload);
    if (error) throw error;

    createMsg.textContent = "Đã tạo ca truyền.";
    volEl.value = ""; dpmEl.value = ""; rateEl.value = "";
    notesEl.value = ""; wantsMail.checked = false; emailToEl.value = "";
    await loadRunning();
  } catch (e) {
    console.error(e);
    createMsg.textContent = "Lỗi tạo ca: " + (e?.message || e);
  }
};

/* ---------- Push UI handlers ---------- */
btnEnablePush.onclick = async () => {
  if (!currentUser) { pushMsg.textContent = "Vui lòng đăng nhập."; return; }
  pushMsg.textContent = "Đang yêu cầu quyền...";
  const res = await requestPushPermissionAndSave(currentUser);
  pushMsg.textContent = res.message || "";
  await refreshPushState();
};
btnCheckPush.onclick = async () => { await refreshPushState(); };

async function refreshPushState(){
  try {
    const st = await checkPushState();
    if (!st.ok) { pushState.textContent = st.message || "Không xác định"; return; }
    pushState.textContent = (st.perm ? "ĐÃ CẤP QUYỀN" : "CHƯA CẤP QUYỀN") +
      (st.optedIn ? " | ĐÃ ĐĂNG KÝ" : " | CHƯA ĐĂNG KÝ") +
      (st.subId ? ` | ID: ${st.subId}` : "");
  } catch (e) {
    pushState.textContent = e?.message || "Lỗi trạng thái";
  }
}

/* ---------- Realtime ---------- */
function setupRealtime() {
  if (!currentUser) return;
  supabase.channel("infusions-change")
    .on("postgres_changes",
      { event: "*", schema: "public", table: "infusions", filter: `user_id=eq.${currentUser.id}` },
      async () => { await loadRunning(); await loadHistory(); }
    ).subscribe();
}

/* ---------- Helpers ---------- */
function escapeHTML(s){ return (s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* ---------- After login ---------- */
async function afterLogin(){
  setAuthUI(true);
  userEmailLbl.textContent = currentUser?.email || "-";
  await loadRunning();
  await loadHistory();
  setupRealtime();
  await initPushForUser(currentUser);
  await refreshPushState();
}

/* ---------- Boot ---------- */
(async () => {
  await getUser();
  if (currentUser) await afterLogin();
})();
