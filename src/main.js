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
const historyList  = document.getElementById("historyList");
const btnReloadHistory = document.getElementById("btnReloadHistory");

/* Push UI */
const btnEnablePush = document.getElementById("btnEnablePush");
const btnCheckPush  = document.getElementById("btnCheckPush");
const pushState     = document.getElementById("pushState");
const pushMsg       = document.getElementById("pushMsg");

let currentUser = null;
let countdownInterval = null;

/* ---------- PWA SW (đăng ký như cũ) ---------- */
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
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
  return currentUser;
}

/* ---------- Sign In / Sign Up / Sign Out ---------- */
btnSignIn.onclick = async () => {
  authMsg.textContent = "Đang đăng nhập...";
  const email = emailEl.value.trim();
  const password = passEl.value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) authMsg.textContent = `Lỗi: ${error.message}`;
  else {
    authMsg.textContent = "Đăng nhập thành công.";
    await afterLogin();
  }
};

btnSignUp.onclick = async () => {
  authMsg.textContent = "Đang đăng ký...";
  const email = emailEl.value.trim();
  const password = passEl.value;
  const { error } = await supabase.auth.signUp({ email, password });
  authMsg.textContent = error ? `Lỗi: ${error.message}` : "Đăng ký thành công. Hãy kiểm tra email xác nhận (nếu bật).";
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
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function pad2(n){ return String(n).padStart(2,"0"); }
function formatHHMMSS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
}
function colorByRemaining(ms){
  if (ms <= 0) return "text-red-700 bg-red-50 border-red-300";
  if (ms <= 5*60*1000) return "text-yellow-700 bg-yellow-50 border-yellow-300";
  return "text-sky-700 bg-sky-50 border-sky-300";
}

function renderRunning(items) {
  runningList.innerHTML = "";
  items.forEach((it) => {
    const end = new Date(it.end_time).getTime();
    const div = document.createElement("div");
    div.className = "border rounded-xl p-3";
    div.dataset.end = String(end);
    div.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="font-semibold">${escapeHTML(it.patient_name)}</div>
        <div class="text-xs text-slate-500">${it.room || ""} ${it.bed || ""}</div>
      </div>
      <div class="mt-2 border rounded-xl p-3 text-center countdown-box">
        <div class="text-3xl font-bold countdown">--:--:--</div>
        <div class="text-xs text-slate-500 mt-1">Kết thúc: ${new Date(it.end_time).toLocaleString()}</div>
      </div>
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
    const end = Number(card.dataset.end);
    const remain = end - now;
    const box = card.querySelector(".countdown-box");
    const label = card.querySelector(".countdown");
    label.textContent = formatHHMMSS(remain);
    box.className = "mt-2 border rounded-xl p-3 text-center countdown-box " + colorByRemaining(remain);
  });
}

function renderHistory(items){
  historyList.innerHTML = "";
  items.forEach((it) => {
    const row = document.createElement("div");
    row.className = "flex items-center justify-between border rounded-xl px-3 py-2";
    row.innerHTML = `
      <div>
        <div class="font-medium">${escapeHTML(it.patient_name)}</div>
        <div class="text-xs text-slate-500">Kết thúc: ${new Date(it.end_time).toLocaleString()}</div>
      </div>
      <span class="badge bg-slate-100 text-slate-700">${it.status}</span>
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
  const { data, error } = await supabase
    .from("infusions")
    .select("id, patient_name, end_time, status")
    .eq("status", "completed")
    .order("end_time", { ascending: false })
    .limit(20);
  if (error) console.error(error);
  renderHistory(data || []);
}
btnReloadHistory.onclick = loadHistory;

btnCreate.onclick = async () => {
  createMsg.textContent = "Đang tạo ca...";
  if (!currentUser) {
    createMsg.textContent = "Vui lòng đăng nhập trước.";
    return;
  }
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
  await loadRunning();
  await loadHistory();
  setupRealtime();

  // Khởi tạo OneSignal cho user và cập nhật trạng thái push
  await initPushForUser(currentUser);
  await refreshPushState();
}

/* ---------- Boot ---------- */
(async () => {
  await getUser();
  if (currentUser) await afterLogin();
})();
