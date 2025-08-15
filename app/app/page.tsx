'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createClient, User } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);
  return null;
}

type Infusion = {
  id: string;
  user_id: string | null;
  patient_name: string;
  room: string | null;
  bed: string | null;
  volume_ml: number;
  drip_rate_dpm: number;
  drops_per_ml: number;
  notes: string | null;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'running' | 'finished' | 'cancelled';
  notify_email: boolean;
  email_sent_at: string | null;
  push_sent_at: string | null;
};

export default function Page() {
  // form state
  const [patientName, setPatientName] = useState('');
  const [room, setRoom] = useState('');
  const [bed, setBed] = useState('');
  const [volume, setVolume] = useState<number | ''>('');
  const [dripRate, setDripRate] = useState<number | ''>('');
  const [dropsPerMl, setDropsPerMl] = useState<number | ''>(20);
  const [notes, setNotes] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [running, setRunning] = useState<Infusion[]>([]);
  const [history, setHistory] = useState<Infusion[]>([]);
  const audioRef = useRef<HTMLAudioElement>(null);

  // register SW + Notification
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);

  // auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) =>
      setUser(s?.user ?? null)
    );
    return () => sub?.subscription.unsubscribe();
  }, []);

  // load data
  const load = async () => {
    const nowIso = new Date().toISOString();

    const { data: run } = await supabase
      .from('infusions')
      .select('*')
      .eq('status', 'scheduled')
      .order('end_time', { ascending: true });

    const { data: hist } = await supabase
      .from('infusions')
      .select('*')
      .eq('status', 'finished')
      .order('end_time', { ascending: false })
      .limit(100);

    setRunning((run ?? []) as Infusion[]);
    setHistory((hist ?? []) as Infusion[]);
  };

  useEffect(() => {
    load();
    // listen realtime for notification_log to popup
    const channel = supabase
      .channel('realtime:notification_log')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notification_log' },
        async (payload) => {
          try {
            // hiện thông báo khi app đang mở
            if ('Notification' in window && Notification.permission === 'granted') {
              const reg = await navigator.serviceWorker.getRegistration();
              reg?.showNotification('Âm thanh khi app đang mở', {
                body: 'Vào phần Lịch sử để xem chi tiết.',
                badge: '/badge.png',
                icon: '/icon-192.png',
                vibrate: [120, 50, 100],
                tag: 'ap-truyendich',
                renotify: true,
              });
            }
            // phát chuông
            audioRef.current?.play().catch(() => {});
            // reload danh sách
            load();
          } catch {}
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientName || !volume || !dripRate || !dropsPerMl) return;

    const vol = Number(volume);
    const rate = Number(dripRate);
    const dpm = Number(dropsPerMl);
    if (vol <= 0 || rate <= 0 || dpm <= 0) return;

    const minutes = Math.ceil((vol * dpm) / rate);
    const start = new Date();
    const end = new Date(start.getTime() + minutes * 60_000);

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id ?? null;

    const { error } = await supabase.from('infusions').insert({
      user_id: uid,
      patient_name: patientName.trim(),
      room: room.trim() || null,
      bed: bed.trim() || null,
      volume_ml: vol,
      drip_rate_dpm: rate,
      drops_per_ml: dpm,
      notes: notes.trim() || null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: 'scheduled',
      notify_email: !!notifyEmail, // <== quan trọng: ghi đúng cờ
    });

    if (!error) {
      // reset form
      setPatientName('');
      setRoom('');
      setBed('');
      setVolume('');
      setDripRate('');
      setDropsPerMl(20);
      setNotes('');
      setNotifyEmail(false);
      load();
    } else {
      alert(error.message);
    }
  };

  const formatTime = (s: string) =>
    new Date(s).toLocaleString(undefined, {
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div className="container" style={{ maxWidth: 960, margin: '24px auto', padding: 16 }}>
      <SwRegister />
      <audio ref={audioRef} src="/alarm.mp3" preload="auto" />
      <h2>AP - Truyendich</h2>

      {/* Form tạo ca */}
      <form onSubmit={onSubmit} style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8 }}>
        <div className="grid" style={{ display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr 1fr' }}>
          <label style={{ gridColumn: '1 / 4' }}>
            Bệnh nhân
            <input
              required
              placeholder="Ví dụ: Phạm Văn A"
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
            />
          </label>
          <label>
            Phòng
            <input placeholder="Ví dụ: 305" value={room} onChange={(e) => setRoom(e.target.value)} />
          </label>
          <label>
            Giường
            <input placeholder="Ví dụ: 12B" value={bed} onChange={(e) => setBed(e.target.value)} />
          </label>
          <label>
            Thể tích thuốc (ml)
            <input
              type="number"
              min={1}
              placeholder="Ví dụ: 500"
              value={volume}
              onChange={(e) => setVolume(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>
          <label>
            Tốc độ truyền (giọt/phút)
            <input
              type="number"
              min={1}
              placeholder="Ví dụ: 25"
              value={dripRate}
              onChange={(e) => setDripRate(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>
          <label>
            Số giọt/ml (giọt/ml)
            <input
              type="number"
              min={1}
              value={dropsPerMl}
              onChange={(e) => setDropsPerMl(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </label>
          <label style={{ gridColumn: '1 / 4' }}>
            Ghi chú
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>

        <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
          <input
            type="checkbox"
            checked={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.checked)}
          />
          Nhận email khi ca kết thúc
        </label>

        <button type="submit" style={{ marginTop: 12 }}>Bắt đầu truyền</button>
      </form>

      {/* Danh sách ca đang chạy */}
      <section style={{ marginTop: 24 }}>
        <h3>Danh sách ca truyền (đang chạy)</h3>
        <div style={{ border: '1px solid #eee', borderRadius: 8 }}>
          {running.length === 0 ? (
            <div style={{ padding: 12, color: '#777' }}>Không có ca đang chạy.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Bệnh nhân</th>
                  <th>Phòng - Giường</th>
                  <th>Kết thúc</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {running.map((r) => (
                  <tr key={r.id}>
                    <td>{r.patient_name}</td>
                    <td>{[r.room, r.bed].filter(Boolean).join(' - ')}</td>
                    <td>{formatTime(r.end_time)}</td>
                    <td>{r.status === 'scheduled' ? 'đang truyền' : r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* Lịch sử */}
      <section style={{ marginTop: 24 }}>
        <h3>Lịch sử ca truyền</h3>
        <div style={{ border: '1px solid #eee', borderRadius: 8 }}>
          {history.length === 0 ? (
            <div style={{ padding: 12, color: '#777' }}>Chưa có lịch sử.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Bệnh nhân</th>
                  <th>Phòng - Giường</th>
                  <th>Kết thúc</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {history.map((r) => (
                  <tr key={r.id}>
                    <td>{r.patient_name}</td>
                    <td>{[r.room, r.bed].filter(Boolean).join(' - ')}</td>
                    <td>{formatTime(r.end_time)}</td>
                    <td>đã kết thúc</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <p style={{ marginTop: 24, color: '#666', textAlign: 'center' }}>
        Phát triển: <strong>Điều dưỡng An Phước</strong>
      </p>
    </div>
  );
}
