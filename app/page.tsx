// app/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "./lib/supabaseClient";

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [patient, setPatient] = useState("");
  const [minutes, setMinutes] = useState(30);
  const [infusionId, setInfusionId] = useState<string | null>(null);
  const [endAt, setEndAt] = useState<Date | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // load session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  // realtime lắng nghe in_app log để bật popup + chuông
  useEffect(() => {
    if (!session?.user?.id) return;
    const ch = supabase
      .channel("notif")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notification_log", filter: `user_id=eq.${session.user.id}` },
        (payload) => {
          if (payload.new?.type === "in_app") {
            ringAndPopup("Ca truyền đã kết thúc!");
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session?.user?.id]);

  function ringAndPopup(message: string) {
    // Notification API
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") new Notification(message);
      else Notification.requestPermission().then((p) => p === "granted" && new Notification(message));
    }
    // Âm thanh
    audioRef.current?.play().catch(() => { /* ignore */ });
    // Modal Bootstrap (dùng native dialog cho đơn giản)
    const dlg = document.getElementById("doneDialog") as HTMLDialogElement | null;
    dlg?.showModal();
  }

  async function signIn() {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  }
  async function signOut() {
    await supabase.auth.signOut();
  }

  // tạo bản ghi infusion và bắt đầu đếm
  async function start() {
    const end = new Date(Date.now() + minutes * 60 * 1000);
    setEndAt(end);

    const { data, error } = await supabase.from("infusions").insert({
      user_id: session?.user?.id ?? null,
      patient_name: patient || null,
      room: null,
      bed: null,
      end_time: end.toISOString(),
      status: "scheduled",
      notify_email: true,
    }).select("id").single();
    if (error) { alert(error.message); return; }
    setInfusionId(data.id);

    // gọi function ngay (khuyến nghị vẫn dùng CRON mỗi phút ở server)
    try {
      await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_FUNCTION_URL}/send-notifications`, {
        method: "GET",
        // có thể thêm ?dry_run=1 để test
      });
    } catch {}
  }

  // simple countdown
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const remaining = endAt ? Math.max(0, Math.floor((endAt.getTime() - now) / 1000)) : 0;
  useEffect(() => {
    if (endAt && remaining === 0) ringAndPopup("Ca truyền đã kết thúc!");
  }, [endAt, remaining]);

  return (
    <main className="container py-4">
      <link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
        rel="stylesheet"
      />
      <h1 className="mb-3">AP truyền dịch</h1>

      {session ? (
        <div className="mb-3">
          <span className="me-2">Xin chào, {session.user.email}</span>
          <button className="btn btn-outline-secondary btn-sm" onClick={signOut}>Đăng xuất</button>
        </div>
      ) : (
        <button className="btn btn-primary mb-3" onClick={signIn}>Đăng nhập Google</button>
      )}

      <div className="card p-3">
        <label className="form-label">Tên bệnh nhân</label>
        <input className="form-control mb-2" value={patient} onChange={e=>setPatient(e.target.value)} />
        <label className="form-label">Thời gian truyền (phút)</label>
        <input type="number" className="form-control mb-3" value={minutes} onChange={e=>setMinutes(+e.target.value)} />
        <button className="btn btn-success" onClick={start} disabled={!session}>Bắt đầu</button>
      </div>

      {endAt && (
        <div className="alert alert-info mt-3">
          Còn lại: {Math.floor(remaining/60)}:{String(remaining%60).padStart(2,"0")} (kết thúc lúc {endAt.toLocaleTimeString()})
        </div>
      )}

      <audio ref={audioRef} src="data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAA..." preload="auto" />
      <dialog id="doneDialog" className="p-3" style={{ borderRadius: 8 }}>
        <h3>Hoàn tất truyền dịch</h3>
        <p>Thông báo đã hiển thị và âm thanh đã phát.</p>
        <form method="dialog"><button className="btn btn-primary">Đóng</button></form>
      </dialog>
    </main>
  );
}
