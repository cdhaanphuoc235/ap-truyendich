'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { createClient, User } from '@supabase/supabase-js';

// ===== Supabase client (giữ nguyên ENV của bạn) =====
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

// ===== Kiểu dữ liệu =====
type Infusion = {
  id: string;
  user_id: string | null;
  patient_name: string | null;
  room: string | null;
  bed: string | null;
  volume_ml: number | null;
  drip_rate_dpm: number | null;   // tốc độ truyền (giọt/phút)
  drops_per_ml: number | null;    // số giọt/ml
  notes: string | null;
  start_time: string;             // ISO
  end_time: string;               // ISO
  status: string | null;
  notify_email: boolean | null;
  email_sent_at?: string | null;
  push_sent_at?: string | null;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yr = d.getFullYear();
  return `${hh}:${mm}:${ss} ${dd}/${mo}/${yr}`;
}

// ⛔️ Luôn hiển thị >= 00:00:00 (không âm)
function secToHMS(total: number) {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function useNow(tickMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(t);
  }, [tickMs]);
  return now;
}

export default function Page() {
  // ===== Auth =====
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // ===== UI state =====
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const v = localStorage.getItem('ap_sound_on');
    return v ? v === '1' : true;
  });
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('ap_sound_on', soundOn ? '1' : '0');
    }
  }, [soundOn]);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const requestNotification = async () => {
    try {
      if (!('Notification' in window)) return;
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    } catch {}
  };

  const beepRef = useRef<HTMLAudioElement | null>(null);

  // ===== Form state =====
  const [patient, setPatient] = useState('');
  const [room, setRoom] = useState('');
  const [bed, setBed] = useState('');
  const [volume, setVolume] = useState<number | ''>('');
  const [dropsPerMl, setDropsPerMl] = useState<number | ''>(20);
  const [dripRate, setDripRate] = useState<number | ''>(''); // giọt/phút
  const [wantEmail, setWantEmail] = useState(false);

  // ===== Data =====
  const [rows, setRows] = useState<Infusion[]>([]);
  const now = useNow(1000);

  // Tách "đang chạy" và "lịch sử" theo thời gian thực
  const running = useMemo(
    () => rows.filter(r => new Date(r.end_time).getTime() - now > 0),
    [rows, now]
  );
  const history = useMemo(
    () => rows.filter(r => new Date(r.end_time).getTime() - now <= 0),
    [rows, now]
  );

  // Load + realtime
  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from<Infusion>('infusions')
        .select('*')
        .order('end_time', { ascending: true });
      if (!error && data) setRows(data);
    };
    load();
    const ch = supabase
      .channel('infusions-stream')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'infusions' },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user]);

  // Tính end_time dự kiến từ inputs
  const expectedEnd = useMemo(() => {
    if (!volume || !dripRate || !dropsPerMl) return null;
    const totalMin = (Number(volume) * Number(dropsPerMl)) / Number(dripRate);
    const end = new Date(Date.now() + totalMin * 60 * 1000);
    return end.toISOString();
  }, [volume, dripRate, dropsPerMl]);

  // Create
  const onCreate = async () => {
    if (!user) return alert('Vui lòng đăng nhập!');
    if (!patient || !room || !bed || !volume || !dropsPerMl || !dripRate) {
      return alert('Vui lòng nhập đủ thông tin!');
    }
    if (!expectedEnd) return;

    const payload: Partial<Infusion> = {
      user_id: user.id,
      patient_name: patient.trim(),
      room: String(room).trim(),
      bed: String(bed).trim(),
      volume_ml: Number(volume),
      drops_per_ml: Number(dropsPerMl),
      drip_rate_dpm: Number(dripRate),
      notes: null, // ẩn trường ghi chú -> để null
      start_time: new Date().toISOString(),
      end_time: expectedEnd,
      status: 'scheduled',
      notify_email: !!wantEmail,
    };

    const { error } = await supabase.from('infusions').insert(payload);
    if (error) {
      console.error(error);
      alert('Lỗi lưu ca truyền. Vui lòng thử lại!');
      return;
    }
    setPatient(''); setRoom(''); setBed('');
    setVolume(''); setDripRate(''); setWantEmail(false);
  };

  // Auth
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  // ====== Đếm ngược + màu + âm thanh ======
  const colorFor = (endISO: string) => {
    const left = Math.floor((new Date(endISO).getTime() - now) / 1000);
    if (left <= 0) return '#ef4444';        // đỏ
    if (left <= 5 * 60) return '#f59e0b';   // vàng
    return '#22c55e';                       // xanh lá
  };

  // Beep khi ≤ 5 phút và khi hết giờ (mỗi ngưỡng 1 lần)
  const prevRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!soundOn) return;
    const beep = () => {
      try {
        if (!beepRef.current) return;
        beepRef.current.currentTime = 0;
        beepRef.current.play().catch(() => {});
      } catch {}
    };
    running.forEach((r) => {
      const left = Math.floor((new Date(r.end_time).getTime() - now) / 1000);
      const prev = prevRef.current[r.id] ?? Infinity;
      if (prev > 300 && left <= 300 && left > 0) beep();
      if (prev > 0 && left <= 0) beep();
      prevRef.current[r.id] = left;
    });
  }, [now, running, soundOn]);

  // ====== Khi hết giờ: Thông báo + Email (không update status để tránh lỗi constraint) ======
  const processedRef = useRef<Set<string>>(new Set());

  const showNotification = async (title: string, body: string) => {
    try {
      if (!('Notification' in window)) return false;
      if (Notification.permission !== 'granted') return false;
      const reg = await (navigator as any).serviceWorker?.getRegistration?.();
      if (reg?.showNotification) {
        await reg.showNotification(title, {
          body,
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          vibrate: [80, 40, 80],
          tag: 'ap-infusion',
        });
      } else {
        new Notification(title, { body, icon: '/icon-192.png' });
      }
      return true;
    } catch { return false; }
  };

  const sendCompletionEmailIfNeeded = async (inf: Infusion, recipient?: string | null) => {
    if (!inf.notify_email) return false;
    try {
      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'INFUSION_COMPLETED',
          infusionId: inf.id,
          to: recipient || null,
          data: {
            patient: inf.patient_name,
            room: inf.room,
            bed: inf.bed,
            end_time: inf.end_time
          }
        })
      });
      return res.ok;
    } catch (e) {
      console.warn('Email notify failed:', e);
      return false;
    }
  };

  const onCompletedOnce = async (inf: Infusion) => {
    if (processedRef.current.has(inf.id)) return;
    processedRef.current.add(inf.id);

    if (Notification.permission === 'granted') {
      const pushOk = await showNotification(
        'Ca truyền đã kết thúc',
        `BN: ${inf.patient_name || '—'} | Phòng ${inf.room || '—'} - Giường ${inf.bed || '—'}`
      );
      if (pushOk) {
        await supabase.from('infusions')
          .update({ push_sent_at: new Date().toISOString() })
          .eq('id', inf.id);
      }
    }

    const emailOk = await sendCompletionEmailIfNeeded(inf, user?.email ?? null);
    if (emailOk) {
      await supabase.from('infusions')
        .update({ email_sent_at: new Date().toISOString() })
        .eq('id', inf.id);
    }
  };

  // Theo dõi các ca đã hết giờ -> chạy 1 lần
  useEffect(() => {
    rows.forEach((r) => {
      const left = Math.floor((new Date(r.end_time).getTime() - now) / 1000);
      if (left <= 0 && !processedRef.current.has(r.id)) {
        onCompletedOnce(r);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now, rows]);

  // ======= UI =======
  if (!user) {
    // Màn đăng nhập giữ nguyên
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="logo">
            <Image src="/icon-512.png" alt="AP Truyền dịch" width={128} height={128} priority />
          </div>
          <h1>AP - Truyền dịch</h1>
          <p className="desc">Ứng dụng tính thời gian truyền dịch cho điều dưỡng – Bệnh viện An Phước</p>
          <button className="btn-login" onClick={signIn}>Đăng nhập bằng Google</button>
          <p className="hint">Vui lòng đăng nhập để tiếp tục</p>
        </div>

        <style jsx>{`
          .login-wrap{min-height:100dvh;display:grid;place-items:center;background:linear-gradient(180deg,#1d4ed8,#60a5fa);padding:24px;color:#fff}
          .login-card{width:100%;max-width:420px;text-align:center;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:16px;padding:28px 20px;backdrop-filter:blur(6px)}
          .logo{display:grid;place-items:center;margin-bottom:12px}
          h1{font-size:22px;margin:6px 0 8px;font-weight:800;letter-spacing:.2px}
          .desc{opacity:.95;font-size:14px;margin-bottom:18px}
          .btn-login{width:100%;padding:14px 16px;border-radius:12px;border:none;background:#fff;color:#1d4ed8;font-weight:800;font-size:16px;box-shadow:0 10px 30px rgba(0,0,0,.22)}
          .btn-login:active{transform:translateY(1px)}
          .hint{margin-top:12px;font-size:12px;opacity:.9}
        `}</style>
      </div>
    );
  }

  return (
    <div className="page">
      <audio ref={beepRef} preload="auto" src="/beep.mp3" />

      {/* ===== 1) TIÊU ĐỀ ===== */}
      <header className="header">
        <div className="title">
          <strong>AP - Truyền dịch</strong>
          <div className="sub">Đăng nhập: {user.email}</div>
        </div>
        <div className="actions">
          {notifPermission !== 'granted' && (
            <button className="btn-outline" onClick={requestNotification}>Bật thông báo</button>
          )}
          <label className="sound">
            <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
            Âm thanh khi app đang mở
          </label>
          <button className="btn-danger" onClick={signOut}>Đăng xuất</button>
        </div>
      </header>

      {/* ===== 2) NHẬP CA ===== */}
      <section className="card">
        <div className="card-head"><h2>Tạo ca truyền</h2></div>

        <div className="formcol">
          <label className="flabel">Bệnh nhân</label>
          <input
            className="finput"
            placeholder="VD: Phạm Văn A"
            value={patient}
            onChange={(e) => setPatient(e.target.value)}
          />

          <label className="flabel">Phòng</label>
          <input
            className="finput"
            placeholder="VD: 305"
            value={room}
            onChange={(e) => setRoom(e.target.value)}
          />

          <label className="flabel">Giường</label>
          <input
            className="finput"
            placeholder="VD: 12B"
            value={bed}
            onChange={(e) => setBed(e.target.value)}
          />

          <label className="flabel">Thể tích (ml)</label>
          <input
            type="number"
            className="finput"
            placeholder="VD: 500"
            value={String(volume)}
            onChange={(e) => setVolume(e.target.value ? Number(e.target.value) : '')}
          />

          {/* "Số giọt/ml" đặt trên "Tốc độ truyền" */}
          <label className="flabel">Số giọt/ml</label>
          <input
            type="number"
            className="finput"
            placeholder="VD: 20"
            value={String(dropsPerMl)}
            onChange={(e) => setDropsPerMl(e.target.value ? Number(e.target.value) : '')}
          />

          <label className="flabel">Tốc độ truyền (giọt/phút)</label>
          <input
            type="number"
            className="finput"
            placeholder="VD: 25"
            value={String(dripRate)}
            onChange={(e) => setDripRate(e.target.value ? Number(e.target.value) : '')}
          />

          {/* ẨN GHI CHÚ: bỏ label + textarea */}

          <div className="row">
            <label className="ck">
              <input type="checkbox" checked={wantEmail} onChange={(e) => setWantEmail(e.target.checked)} />
              Nhận email khi ca kết thúc
            </label>

            {/* Nút to & nổi bật */}
            <button className="btn-primary" onClick={onCreate}>
              Bắt đầu truyền
            </button>
          </div>

          <div className="endhint">
            {expectedEnd
              ? <>Kết thúc dự kiến: <strong>{formatDateTime(expectedEnd)}</strong></>
              : <span>Nhập đủ các trường để tính thời gian kết thúc.</span>}
          </div>
        </div>
      </section>

      {/* ===== 3) CA ĐANG CHẠY ===== */}
      <section className="card">
        <div className="card-head">
          <h2>Ca đang chạy</h2>
          <span className="badge-soft blue">{running.length}</span>
        </div>

        {running.length === 0 ? (
          <div className="empty">Không có ca đang chạy.</div>
        ) : (
          <div className="list">
            {running.map((r) => {
              const rawLeft = Math.floor((new Date(r.end_time).getTime() - now) / 1000);
              const leftSec = Math.max(0, rawLeft);
              const col = colorFor(r.end_time);
              return (
                <div className="rowitem" key={r.id}>
                  <div className="cell"><div className="label">Bệnh nhân</div><div className="value">{r.patient_name || '—'}</div></div>
                  <div className="cell"><div className="label">Phòng - Giường</div><div className="value">{r.room || '—'} - {r.bed || '—'}</div></div>
                  <div className="cell"><div className="label">Kết thúc</div><div className="value">{formatDateTime(r.end_time)}</div></div>
                  <div className="cell"><div className="label">Trạng thái</div><div className="value">đang truyền</div></div>
                  <div className="count">
                    <span className="badge-count" style={{ background: col }}>{secToHMS(leftSec)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ===== 4) LỊCH SỬ ===== */}
      <section className="card">
        <div className="card-head">
          <h2>Lịch sử ca truyền</h2>
          <button
            className="btn-light"
            onClick={async () => {
              if (!confirm('Xoá toàn bộ lịch sử?')) return;
              const nowISO = new Date().toISOString();
              await supabase.from('infusions').delete().lte('end_time', nowISO);
            }}
          >Xoá toàn bộ lịch sử</button>
        </div>

        {history.length === 0 ? (
          <div className="empty">Chưa có lịch sử.</div>
        ) : (
          <div className="list">
            {history.map((h) => (
              <div className="rowitem" key={h.id}>
                <div className="cell"><div className="label">Bệnh nhân</div><div className="value">{h.patient_name || '—'}</div></div>
                <div className="cell"><div className="label">Phòng - Giường</div><div className="value">{h.room || '—'} - {h.bed || '—'}</div></div>
                <div className="cell"><div className="label">Kết thúc</div><div className="value">{formatDateTime(h.end_time)}</div></div>
                <div className="cell"><div className="label">Trạng thái</div><div className="value">đã kết thúc</div></div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="foot">Phát triển: Điều dưỡng An Phước</footer>

      {/* ===== CSS ===== */}
      <style jsx>{`
        :root{
          --blue-700:#1d4ed8; --blue-500:#2563eb; --blue-200:#bfdbfe; --blue-100:#dbeafe; --blue-50:#eff6ff;
          --green:#22c55e; --yellow:#f59e0b; --red:#ef4444;
          --card:#ffffff; --line:#e5e7eb; --muted:#6b7280; --text:#0f172a;
        }
        /* Nền xanh dương cho màn hình chính */
        .page{
          max-width: 980px;
          margin: 0 auto;
          padding: 16px 14px 28px;
          min-height: 100dvh;
          color: var(--text);
          background: radial-gradient(1200px 600px at 10% -10%, var(--blue-100), transparent 40%),
                      radial-gradient(900px 500px at 100% 0%, var(--blue-50), transparent 55%),
                      linear-gradient(180deg, var(--blue-50), #ffffff);
        }

        .header{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;margin-bottom:12px}
        .title strong{font-size:24px;letter-spacing:.2px}
        .sub{font-size:14px;color:#1f2937;opacity:.9;margin-top:2px}
        .actions{display:flex;align-items:center;gap:10px;justify-self:end;flex-wrap:wrap}
        .sound{display:inline-flex;gap:8px;align-items:center;font-size:13px;color:#374151;background:#eef2ff;padding:6px 10px;border-radius:10px;border:1px solid #dbeafe}
        .btn-outline{background:#fff;border:1px solid var(--line);padding:8px 12px;border-radius:10px;font-weight:700;color:var(--blue-700)}
        .btn-danger{background:#fff;border:1px solid var(--line);padding:8px 12px;border-radius:10px;font-weight:700;color:var(--red)}

        .card{
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 16px;
          margin-top: 12px;
          box-shadow: 0 10px 30px rgba(30,58,138,.08);
        }
        .card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}
        h2{font-size:20px;margin:2px 2px 6px;display:inline-flex;align-items:center;gap:8px}
        .badge-soft{display:inline-block;font-size:12px;padding:6px 10px;border-radius:999px;background:#eff6ff;color:var(--blue-700);border:1px solid #dbeafe}

        .formcol{display:grid;grid-template-columns:1fr;gap:10px}
        /* Label to và dễ đọc hơn */
        .flabel{font-size:16px;color:#0f172a;font-weight:700}
        .finput{
          width:100%;
          background:#ffffff;
          border: 2px solid #e5e7eb;
          padding: 14px 14px;
          border-radius: 12px;
          font-size:17px;
          transition: border-color .15s, box-shadow .15s;
        }
        .finput:focus{outline:none;border-color:var(--blue-500);box-shadow:0 0 0 3px rgba(37,99,235,.15)}

        .row{display:flex;align-items:center;gap:12px;margin-top:8px;flex-wrap:wrap}
        .ck{display:inline-flex;gap:8px;align-items:center;font-size:15px}

        /* Nút bắt đầu truyền: lớn & nổi bật */
        .btn-primary{
          background: linear-gradient(90deg, var(--blue-700), var(--green));
          color:#fff;
          border:0;
          padding:16px 20px;
          border-radius:14px;
          font-weight:900;
          font-size:18px;
          letter-spacing:.3px;
          box-shadow: 0 12px 30px rgba(37,99,235,.25);
          width:100%;
        }
        @media (min-width:720px){
          .btn-primary{width:auto;min-width:220px;margin-left:auto}
        }

        .endhint{margin-top:4px;font-size:13px;color:var(--muted)}
        .list{display:grid;gap:8px}
        .rowitem{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:center;padding:12px;border:1px solid var(--line);border-radius:12px;background:#fff}
        .cell .label{font-size:12px;color:var(--muted)}
        .cell .value{font-size:16px;font-weight:700}
        .count{grid-column:1 / -1;display:flex;justify-content:flex-start}
        .badge-count{display:inline-block;color:#fff;font-weight:900;letter-spacing:.5px;padding:10px 14px;border-radius:999px;min-width:120px;text-align:center;font-variant-numeric:tabular-nums;box-shadow:0 10px 18px rgba(0,0,0,.08)}
        .empty{padding:6px 8px;color:var(--muted);font-size:14px}
        .btn-light{background:#f3f4f6;border:1px solid var(--line);padding:8px 12px;border-radius:10px;font-weight:700;color:#111827}
        .foot{text-align:center;color:var(--muted);font-size:12px;margin-top:16px}

        /* Desktop layout cho list */
        @media(min-width:720px){
          .rowitem{grid-template-columns:1.2fr .9fr 1fr .9fr auto}
          .count{grid-column:auto;justify-content:flex-end}
        }
      `}</style>
    </div>
  );
}
