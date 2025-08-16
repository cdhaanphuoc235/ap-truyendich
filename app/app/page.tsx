'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import { createClient, User } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
);

type Infusion = {
  id: string;
  user_id: string | null;
  patient_name: string | null;
  room: string | null;
  bed: string | null;
  volume_ml: number | null;
  drip_rate_dpm: number | null;
  drops_per_ml: number | null;
  notes: string | null;
  start_time: string;
  end_time: string;
  status: 'scheduled' | 'running' | 'completed' | null;
  notify_email: boolean | null;
  email_sent_at?: string | null;
  push_sent_at?: string | null;
};

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const dd = d.getDate();
  const mo = d.getMonth() + 1;
  const yr = d.getFullYear();
  return `${hh}:${mm}:${ss} ${dd}/${mo}/${yr}`;
}

function secToHMS(total: number) {
  const sign = total < 0 ? '-' : '';
  const s = Math.abs(total);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return `${sign}${hh}:${mm}:${ss}`;
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
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const [soundOn, setSoundOn] = useState(true);
  const beepRef = useRef<HTMLAudioElement | null>(null);

  const [patient, setPatient] = useState('');
  const [room, setRoom] = useState('');
  const [bed, setBed] = useState('');
  const [volume, setVolume] = useState<number | ''>('');
  const [dropsPerMl, setDropsPerMl] = useState<number | ''>(20);
  const [dripRate, setDripRate] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [wantEmail, setWantEmail] = useState(false);

  const [running, setRunning] = useState<Infusion[]>([]);
  const [history, setHistory] = useState<Infusion[]>([]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from<Infusion>('infusions')
        .select('*')
        .order('end_time', { ascending: true });

      if (!error && data) {
        const now = Date.now();
        setRunning(
          data.filter(
            (x) =>
              (x.status === 'running' || x.status === 'scheduled') &&
              new Date(x.end_time).getTime() - now >= -24 * 3600 * 1000
          )
        );
        setHistory(data.filter((x) => x.status === 'completed'));
      }
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

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  const expectedEnd = useMemo(() => {
    if (!volume || !dripRate || !dropsPerMl) return null;
    const totalMin = (Number(volume) * Number(dropsPerMl)) / Number(dripRate);
    const end = new Date(Date.now() + totalMin * 60 * 1000);
    return end.toISOString();
  }, [volume, dripRate, dropsPerMl]);

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
      notes: notes.trim() || null,
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

    setPatient('');
    setRoom('');
    setBed('');
    setVolume('');
    setDripRate('');
    setNotes('');
    setWantEmail(false);
  };
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const now = useNow(1000);
  const colorFor = (endISO: string) => {
    const left = Math.floor((new Date(endISO).getTime() - now) / 1000);
    if (left <= 0) return '#ef4444';
    if (left <= 5 * 60) return '#f59e0b';
    return '#22c55e';
  };

  const prevRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (!soundOn) return;
    const doBeep = () => {
      try {
        beepRef.current?.play().catch(() => {});
      } catch {}
    };

    running.forEach(async (r) => {
      const left = Math.floor((new Date(r.end_time).getTime() - now) / 1000);
      const prev = prevRef.current[r.id] ?? Infinity;

      if (prev > 300 && left <= 300 && left > 0) doBeep();
      if (prev > 0 && left <= 0) doBeep();

      prevRef.current[r.id] = left;

      if (left <= 0 && r.status !== 'completed') {
        const updates: Partial<Infusion> = {
          status: 'completed',
          ...(r.notify_email && !r.email_sent_at
            ? { email_sent_at: new Date().toISOString() }
            : {})
        };

        await supabase.from('infusions').update(updates).eq('id', r.id);
      }
    });
  }, [now, running, soundOn]);

  if (!user) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="logo">
            <Image
              src="/icon-512.png"
              alt="AP Truyền dịch"
              width={128}
              height={128}
              priority
            />
          </div>
          <h1>AP - Truyền dịch</h1>
          <p className="desc">
            Ứng dụng tính thời gian truyền dịch cho điều dưỡng – Bệnh viện An
            Phước
          </p>
          <button className="btn-login" onClick={signIn}>
            Đăng nhập bằng Google
          </button>
          <p className="hint">Vui lòng đăng nhập để tiếp tục</p>
        </div>
        <style jsx>{`
          .login-wrap {
            min-height: 100dvh;
            display: grid;
            place-items: center;
            background: linear-gradient(180deg, #1d4ed8, #60a5fa);
            padding: 24px;
            color: #fff;
          }
          .login-card {
            width: 100%;
            max-width: 420px;
            text-align: center;
            background: rgba(255, 255, 255, 0.12);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 16px;
            padding: 28px 20px;
            backdrop-filter: blur(6px);
          }
          .logo {
            display: grid;
            place-items: center;
            margin-bottom: 12px;
          }
          h1 {
            font-size: 22px;
            margin: 6px 0 8px;
            font-weight: 700;
          }
          .desc {
            opacity: 0.9;
            font-size: 14px;
            margin-bottom: 18px;
          }
          .btn-login {
            width: 100%;
            padding: 14px 16px;
            border-radius: 10px;
            border: none;
            background: #fff;
            color: #1d4ed8;
            font-weight: 700;
            font-size: 16px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
          }
          .btn-login:active {
            transform: translateY(1px);
          }
          .hint {
            margin-top: 12px;
            font-size: 12px;
            opacity: 0.9;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="page">
      <audio ref={beepRef} preload="auto" src="/beep.mp3" />

      <header className="header">
        <div className="title">
          <strong>AP - Truyendich</strong>
          <div className="sub">Đăng nhập: {user.email}</div>
        </div>
        <div className="actions">
          <label className="sound">
            <input
              type="checkbox"
              checked={soundOn}
              onChange={(e) => setSoundOn(e.target.checked)}
            />
            Âm thanh khi app đang mở
          </label>
          <button className="btn-outline" onClick={signOut}>
            Đăng xuất
          </button>
        </div>
      </header>

      <section className="card">
        <h2>Tạo ca truyền</h2>
        <div className="formcol">
          <label>Bệnh nhân</label>
          <input value={patient} onChange={(e) => setPatient(e.target.value)} />

          <label>Phòng</label>
          <input value={room} onChange={(e) => setRoom(e.target.value)} />

          <label>Giường</label>
          <input value={bed} onChange={(e) => setBed(e.target.value)} />

          <label>Thể tích (ml)</label>
          <input
            type="number"
            value={String(volume)}
            onChange={(e) =>
              setVolume(e.target.value ? Number(e.target.value) : '')
            }
          />

          <label>Số giọt/ml</label>
          <input
            type="number"
            value={String(dropsPerMl)}
            onChange={(e) =>
              setDropsPerMl(e.target.value ? Number(e.target.value) : '')
            }
          />

          <label>Tốc độ truyền (giọt/phút)</label>
          <input
            type="number"
            value={String(dripRate)}
            onChange={(e) =>
              setDripRate(e.target.value ? Number(e.target.value) : '')
            }
          />

          <label>Ghi chú</label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />

          <div className="row">
            <label className="ck">
              <input
                type="checkbox"
                checked={wantEmail}
                onChange={(e) => setWantEmail(e.target.checked)}
              />
              Nhận email khi ca kết thúc
            </label>
            <button className="btn" onClick={onCreate}>
              Bắt đầu truyền
            </button>
          </div>

          <div className="endhint">
            {expectedEnd ? (
              <>
                Kết thúc dự kiến:{' '}
                <strong>{formatDateTime(expectedEnd)}</strong>
              </>
            ) : (
              <span>Nhập đủ các trường để tính thời gian kết thúc.</span>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <h2>Danh sách ca truyền (đang chạy)</h2>
        {running.length === 0 ? (
          <div className="empty">Không có ca đang chạy.</div>
        ) : (
          <div className="list">
            {running.map((r) => {
              const leftSec = Math.floor(
                (new Date(r.end_time).getTime() - now) / 1000
              );
              const col = colorFor(r.end_time);
              const status =
                leftSec <= 0 ? 'đã kết thúc' : (r.status ?? 'đang truyền');

              return (
                <div className="rowitem" key={r.id}>
                  <div className="cell">
                    <div className="label">Bệnh nhân</div>
                    <div className="value">{r.patient_name || '—'}</div>
                  </div>
                  <div className="cell">
                    <div className="label">Phòng - Giường</div>
                    <div className="value">
                      {r.room || '—'} - {r.bed || '—'}
                    </div>
                  </div>
                  <div className="cell">
                    <div className="label">Kết thúc</div>
                    <div className="value">{formatDateTime(r.end_time)}</div>
                  </div>
                  <div className="cell">
                    <div className="label">Trạng thái</div>
                    <div className="value">{status}</div>
                  </div>
                  <div className="count">
                    <span className="badge" style={{ background: col }}>
                      {secToHMS(leftSec > 0 ? leftSec : 0)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="card">
        <div className="row space">
          <h2>Lịch sử ca truyền</h2>
          <button
            className="btn-light"
            onClick={async () => {
              if (!confirm('Xoá toàn bộ lịch sử?')) return;
              await supabase.from('infusions').delete().eq('status', 'completed');
            }}
          >
            Xoá toàn bộ lịch sử
          </button>
        </div>
        {history.length === 0 ? (
          <div className="empty">Chưa có lịch sử.</div>
        ) : (
          <div className="list">
            {history.map((h) => (
              <div className="rowitem" key={h.id}>
                <div className="cell">
                  <div className="label">Bệnh nhân</div>
                  <div className="value">{h.patient_name || '—'}</div>
                </div>
                <div className="cell">
                  <div className="label">Phòng - Giường</div>
                  <div className="value">
                    {h.room || '—'} - {h.bed || '—'}
                  </div>
                </div>
                <div className="cell">
                  <div className="label">Kết thúc</div>
                  <div className="value">{formatDateTime(h.end_time)}</div>
                </div>
                <div className="cell">
                  <div className="label">Trạng thái</div>
                  <div className="value">đã kết thúc</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="foot">Phát triển: Điều dưỡng An Phước</footer>
    </div>
  );
}
