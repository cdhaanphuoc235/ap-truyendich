'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient, PostgrestSingleResponse } from '@supabase/supabase-js';

// ===== Supabase client (browser) =====
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type InfusionRow = {
  id: string;
  user_id: string | null;
  patient_name: string | null;
  room: string | null;
  bed: string | null;
  volume_ml: number | null;
  drip_rate_dpm: number | null; // giọt/phút
  drops_per_ml: number | null;  // giọt/ml
  notes: string | null;
  start_time: string | null;
  end_time: string;              // ISO
  status: string | null;         // 'scheduled' | 'finished' | ...
  notify_email: boolean | null;  // người dùng tick
  email_sent_at: string | null;
  push_sent_at: string | null;
  created_at?: string | null;
};

type NotiLogRow = {
  id: string;
  user_id: string | null;
  infusion_id: string | null;
  type: 'email' | 'push' | 'in_app';
  created_at: string;
};

// ===== Một số util nhỏ =====
const viTime = (iso?: string | null) => {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('vi-VN');
  } catch {
    return iso;
  }
};

const mmss = (msLeft: number) => {
  if (msLeft < 0) msLeft = 0;
  const s = Math.floor(msLeft / 1000);
  const m = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

function computeEndTime(volumeMl: number, dripRateDpm: number, dropsPerMl: number) {
  // Thời gian (phút) = (thể tích ml * giọt/ml) / (giọt/phút)
  if (!volumeMl || !dripRateDpm || !dropsPerMl) return new Date();
  const minutes = (volumeMl * dropsPerMl) / dripRateDpm;
  return new Date(Date.now() + minutes * 60 * 1000);
}

// ===== Chuông beep khi app đang mở (WebAudio, không phụ thuộc file audio) =====
function useBeep() {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    return () => ctxRef.current?.close().catch(() => {});
  }, []);
  return useCallback((durationMs = 300, freq = 880) => {
    try {
      const ctx = ctxRef.current;
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.04; // nhỏ, vừa đủ chú ý
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        osc.stop();
      }, durationMs);
    } catch {
      // ignore
    }
  }, []);
}

// ===== Đăng ký service worker (nếu có) =====
function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {});
    }
  }, []);
  return null;
}

export default function AppPage() {
  // ====== Form state ======
  const [patient, setPatient] = useState('');
  const [room, setRoom] = useState('');
  const [bed, setBed] = useState('');
  const [volume, setVolume] = useState<number | ''>('');
  const [dripRate, setDripRate] = useState<number | ''>(''); // giọt/phút
  const [dropsPerMl, setDropsPerMl] = useState<number | ''>(''); // giọt/ml
  const [notes, setNotes] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  // ====== Data state ======
  const [infusions, setInfusions] = useState<InfusionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const beep = useBeep();

  // ====== Auth: lấy user đang đăng nhập ======
  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (ignore) return;
      if (error || !data.user) {
        setUserEmail(null);
      } else {
        setUserEmail(data.user.email ?? null);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  // ====== Load danh sách ca ======
  const loadInfusions = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const q = supabase
      .from('infusions')
      .select(
        'id,user_id,patient_name,room,bed,volume_ml,drip_rate_dpm,drops_per_ml,notes,start_time,end_time,status,notify_email,email_sent_at,push_sent_at,created_at'
      )
      .order('created_at', { ascending: false })
      .limit(100);

    // RLS đảm bảo chỉ thấy dữ liệu của mình; nếu muốn lọc theo user_id:
    // if (user?.id) q.eq('user_id', user.id);

    const { data, error } = await q;
    if (!error && data) setInfusions(data as any);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadInfusions();
  }, [loadInfusions]);

  // Realtime: khi bảng infusions thay đổi, tự reload
  useEffect(() => {
    const channel = supabase
      .channel('infusions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'infusions' },
        () => {
          // reload nhẹ
          loadInfusions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadInfusions]);

  // Realtime: nhận in-app log để popup và kêu chuông
  useEffect(() => {
    const sub = supabase
      .channel('noti-log')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_log' },
        async (payload) => {
          const row = payload.new as NotiLogRow;
          if (row.type !== 'in_app') return;

          // xin quyền thông báo nếu chưa có
          if (typeof window !== 'undefined' && 'Notification' in window) {
            if (Notification.permission === 'default') {
              try {
                await Notification.requestPermission();
              } catch {}
            }
            if (Notification.permission === 'granted') {
              // Hiện popup
              const reg = await navigator.serviceWorker?.getRegistration();
              const title = 'AP - Truyền dịch';
              const body = 'Một ca truyền đã kết thúc. Vui lòng kiểm tra.';
              if (reg?.showNotification) {
                reg.showNotification(title, {
                  body,
                  tag: 'ap-truyendich',
                  renotify: true,
                  vibrate: [80, 80, 80],
                });
              } else {
                new Notification(title, { body });
              }
              // Chuông
              if (soundOn) beep(320, 960);
            }
          }
          // reload danh sách để phản ánh trạng thái
          loadInfusions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(sub);
    };
  }, [beep, soundOn, loadInfusions]);

  // ====== Tính countdown cho từng ca ======
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const now = useMemo(() => Date.now(), [nowTick]);

  // Tách danh sách đang chạy và đã xong
  const running = useMemo(() => {
    return (infusions || []).filter((x) => {
      const isFinished = x.status === 'finished' || !!x.email_sent_at;
      if (isFinished) return false;
      return new Date(x.end_time).getTime() > now;
    });
  }, [infusions, now]);

  const history = useMemo(() => {
    return (infusions || []).filter((x) => {
      const finished = x.status === 'finished' || !!x.email_sent_at || new Date(x.end_time).getTime() <= now;
      return finished;
    });
  }, [infusions, now]);

  // ====== Lưu ca mới ======
  const handleStart = useCallback(async () => {
    const vol = Number(volume);
    const rate = Number(dripRate);
    const dpm = Number(dropsPerMl);
    if (!patient || !vol || !rate || !dpm) {
      alert('Vui lòng nhập đầy đủ: Bệnh nhân, Thể tích, Tốc độ, Số giọt/ml.');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Bạn chưa đăng nhập.');
      return;
    }

    const end = computeEndTime(vol, rate, dpm);

    const { error } = await supabase.from('infusions').insert({
      user_id: user.id, // <<< quan trọng: để Edge Function tra email từ auth.users
      patient_name: patient.trim(),
      room: room.trim(),
      bed: bed.trim(),
      volume_ml: vol,
      drip_rate_dpm: rate,
      drops_per_ml: dpm,
      notes: notes.trim() || null,
      start_time: new Date().toISOString(),
      end_time: end.toISOString(),
      status: 'scheduled',
      notify_email: !!notifyEmail, // <<< cờ tick
    } as Partial<InfusionRow>);

    if (error) {
      console.error(error);
      alert('Không thể lưu ca.');
    } else {
      // reset nhẹ
      setPatient('');
      setNotes('');
      // giữ lại các preset như phòng/giường/tốc độ nếu bạn muốn
      loadInfusions();
    }
  }, [patient, room, bed, volume, dripRate, dropsPerMl, notes, notifyEmail, loadInfusions]);

  // ====== Xoá toàn bộ lịch sử (đã kết thúc) ======
  const clearHistory = useCallback(async () => {
    const ok = confirm('Xoá toàn bộ lịch sử đã kết thúc? Hành động không thể hoàn tác.');
    if (!ok) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('infusions')
      .delete()
      .or('status.eq.finished,email_sent_at.not.is.null')
      // .eq('user_id', user.id) // có thể không cần vì RLS
      ;

    if (error) {
      console.error(error);
      alert('Xoá lịch sử thất bại.');
    } else {
      loadInfusions();
    }
  }, [loadInfusions]);

  return (
    <div className="container" style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
      <SwRegister />

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>AP - Truyendich</h1>
        <div style={{ fontSize: 13, opacity: 0.7 }}>
          {userEmail ? <>Đăng nhập: <b>{userEmail}</b></> : <>Vui lòng đăng nhập</>}
        </div>
      </header>

      {/* Khối cài đặt nhỏ */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
          Âm thanh khi app đang mở
        </label>
      </div>

      {/* Form tạo ca */}
      <section style={{ border: '1px solid #e7e7e7', borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Tạo ca truyền</h3>

        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <div>
            <label>Bệnh nhân</label>
            <input value={patient} onChange={(e) => setPatient(e.target.value)} className="ipt" placeholder="VD: Phạm Văn A" />
          </div>

          <div>
            <label>Phòng</label>
            <input value={room} onChange={(e) => setRoom(e.target.value)} className="ipt" placeholder="VD: 305" />
          </div>

          <div>
            <label>Giường</label>
            <input value={bed} onChange={(e) => setBed(e.target.value)} className="ipt" placeholder="VD: 12B" />
          </div>

          <div>
            <label>Thể tích (ml)</label>
            <input
              value={volume}
              onChange={(e) => setVolume(e.target.value === '' ? '' : Number(e.target.value))}
              type="number"
              className="ipt"
              placeholder="VD: 500"
              min={1}
            />
          </div>

          <div>
            <label>Tốc độ (giọt/phút)</label>
            <input
              value={dripRate}
              onChange={(e) => setDripRate(e.target.value === '' ? '' : Number(e.target.value))}
              type="number"
              className="ipt"
              placeholder="VD: 25"
              min={1}
            />
          </div>

          <div>
            <label>Số giọt/ml</label>
            <input
              value={dropsPerMl}
              onChange={(e) => setDropsPerMl(e.target.value === '' ? '' : Number(e.target.value))}
              type="number"
              className="ipt"
              placeholder="VD: 20"
              min={1}
            />
          </div>
        </div>

        <div style={{ marginTop: 8 }}>
          <label>Ghi chú</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="ipt" rows={3} placeholder="..." />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            Nhận email khi ca kết thúc
          </label>

          <button className="btn" onClick={handleStart}>Bắt đầu truyền</button>
        </div>
      </section>

      {/* Danh sách ca đang chạy */}
      <section style={{ border: '1px solid #e7e7e7', borderRadius: 8, padding: 12, marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 8px', fontSize: 16 }}>Danh sách ca truyền (đang chạy)</h3>
        <table className="tbl">
          <thead>
            <tr>
              <th>Bệnh nhân</th>
              <th>Phòng - Giường</th>
              <th>Kết thúc</th>
              <th>Đếm ngược</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {running.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', opacity: 0.6 }}>Không có ca đang chạy.</td></tr>
            )}
            {running.map((x) => {
              const endMs = new Date(x.end_time).getTime();
              const left = Math.max(0, endMs - now);
              const status = left > 0 ? 'đang truyền' : 'đã kết thúc';
              return (
                <tr key={x.id}>
                  <td>{x.patient_name ?? '-'}</td>
                  <td>{(x.room ?? '-') + ' - ' + (x.bed ?? '-')}</td>
                  <td>{viTime(x.end_time)}</td>
                  <td style={{ fontWeight: 700, color: left <= 0 ? '#c00' : '#111' }}>{mmss(left)}</td>
                  <td>{status}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* Lịch sử ca */}
      <section style={{ border: '1px solid #e7e7e7', borderRadius: 8, padding: 12, marginBottom: 40 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>Lịch sử ca truyền</h3>
          <button className="btn danger" onClick={clearHistory}>Xoá toàn bộ lịch sử</button>
        </div>

        <table className="tbl" style={{ marginTop: 8 }}>
          <thead>
            <tr>
              <th>Bệnh nhân</th>
              <th>Phòng - Giường</th>
              <th>Kết thúc</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {history.length === 0 && (
              <tr><td colSpan={4} style={{ textAlign: 'center', opacity: 0.6 }}>Chưa có lịch sử.</td></tr>
            )}
            {history.map((x) => (
              <tr key={x.id}>
                <td>{x.patient_name ?? '-'}</td>
                <td>{(x.room ?? '-') + ' - ' + (x.bed ?? '-')}</td>
                <td>{viTime(x.end_time)}</td>
                <td style={{ color: '#0a7' }}>đã kết thúc</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6 }}>Chỉ xoá lịch sử khi không còn cần đối chiếu.</div>
      </section>

      <footer style={{ textAlign: 'center', fontSize: 13, opacity: 0.75, marginBottom: 24 }}>
        Phát triển: <b>Điều dưỡng An Phước</b>
      </footer>

      {/* CSS nhỏ gọn */}
      <style jsx>{`
        .ipt {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #dcdcdc;
          border-radius: 6px;
          outline: none;
        }
        .ipt:focus { border-color: #1971ff; box-shadow: 0 0 0 2px rgba(25,113,255,0.12); }
        .btn {
          appearance: none;
          border: none;
          background: #1971ff;
          color: #fff;
          padding: 8px 14px;
          border-radius: 6px;
          cursor: pointer;
        }
        .btn.danger { background: #ff4d4f; }
        .btn:disabled { opacity: .6; cursor: not-allowed; }
        .tbl { width: 100%; border-collapse: collapse; }
        .tbl th, .tbl td { border-bottom: 1px solid #eee; padding: 8px; text-align: left; }
        .tbl th { background: #fafafa; font-weight: 600; }
        @media (max-width: 640px) {
          .container { padding: 0 10px; }
          section { padding: 12px; }
          .tbl th:nth-child(2), .tbl td:nth-child(2) { display: none; } /* thu gọn trên mobile */
        }
      `}</style>
    </div>
  );
}
