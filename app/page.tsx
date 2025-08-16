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

    const { error } = await supabase
.from('infusions').insert(payload);
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
        status: 'completed'
      };

      if (r.notify_email && !r.email_sent_at) {
        updates.email_sent_at = new Date().toISOString();
      }

      console.log('⏱ Cập nhật infusion:', r.id, updates);

      const { error } = await supabase
        .from('infusions')
        .update(updates)
        .eq('id', r.id)
        .select();

      if (error) {
        console.error('❌ Lỗi cập nhật ca:', error.message);
      }
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

      {/* Phần giao diện chính (form, danh sách, lịch sử) */}
      {/* Bạn giữ nguyên phần này như phiên bản UI trước — hoặc nếu cần mình sẽ dán tiếp */}

      <style jsx>{`
        .page {
          max-width: 980px;
          margin: 0 auto;
          padding: 16px 14px 28px;
          background: #f7fafc;
          min-height: 100dvh;
        }
        .header {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        }
        .title strong {
          font-size: 22px;
        }
        .sub {
          font-size: 13px;
          color: #374151;
          opacity: 0.9;
          margin-top: 2px;
        }
        .actions {
          display: flex;
          align-items: center;
          gap: 10px;
          justify-self: end;
        }
        .sound {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          font-size: 13px;
          color: #374151;
        }
        .btn-outline {
          background: #fff;
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          border-radius: 10px;
          font-weight: 600;
          color: #ef4444;
        }
        .card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 14px;
          margin-top: 12px;
        }
        h2 {
          font-size: 18px;
          margin: 2px 2px 10px;
        }
        .formcol {
          display: grid;
          grid-template-columns: 1fr;
          gap: 8px;
        }
        label {
          font-size: 13px;
          color: #374151;
        }
        input,
        textarea {
          width: 100%;
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          padding: 12px 12px;
          border-radius: 10px;
          font-size: 16px;
        }
        textarea {
          min-height: 120px;
        }
        .row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .ck {
          display: inline-flex;
          gap: 8px;
          align-items: center;
          font-size: 14px;
        }
        .btn {
          background: #2563eb;
          color: #fff;
          border: 0;
          padding: 12px 14px;
          border-radius: 10px;
          font-weight: 700;
          margin-left: auto;
        }
        .endhint {
          margin-top: 6px;
          font-size: 12px;
          color: #6b7280;
        }
        .list {
          display: grid;
          gap: 8px;
        }
        .rowitem {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          align-items: center;
          padding: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
        }
        .cell .label {
          font-size: 11px;
          color: #6b7280;
        }
        .cell .value {
          font-size: 15px;
          font-weight: 600;
        }
        .count {
          grid-column: 1 / -1;
          display: flex;
          justify-content: flex-start;
        }
        .badge {
          display: inline-block;
          color: #fff;
          font-weight: 800;
          letter-spacing: 0.5px;
          padding: 8px 12px;
          border-radius: 999px;
          min-width: 120px;
          text-align: center;
          font-variant-numeric: tabular-nums;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }
        .empty {
          padding: 6px 8px;
          color: #6b7280;
          font-size: 14px;
        }
        .row.space {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .btn-light {
          background: #f3f4f6;
          border: 1px solid #e5e7eb;
          padding: 8px 12px;
          border-radius: 10px;
          font-weight: 600;
        }
        .foot {
          text-align: center;
          color: #6b7280;
          font-size: 12px;
          margin-top: 16px;
        }
        @media (min-width: 720px) {
          .rowitem {
            grid-template-columns: 1.2fr 0.9fr 1fr 0.9fr auto;
            align-items: center;
          }
          .count {
            grid-column: auto;
            justify-content: flex-end;
          }
        }
      `}</style>
    </div>
  );
}
