'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

/* ========= Supabase ========= */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/* ========= SW Register ========= */
function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}

/* ========= Types ========= */
type InfusionRow = {
  id: string;
  user_id: string | null;
  patient_name: string | null;
  room: string | null;
  bed: string | null;
  volume: number | null;
  drip_rate_dpm: number | null;
  drops_per_ml: number | null;
  notes: string | null;
  start_time: string;
  end_time: string;
  notify_email: boolean | null;
  email_sent_at: string | null;
};

function toNumber(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ========= Small helpers ========= */
function useNow(tick = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tick);
    return () => clearInterval(id);
  }, [tick]);
  return now;
}

function formatHMS(totalSec: number) {
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  return `${hh.toString().padStart(2, '0')}:${mm
    .toString()
    .padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
}

function Countdown({ endISO }: { endISO: string }) {
  const now = useNow(1000);
  const end = new Date(endISO).getTime();
  const remainMs = end - now;
  const remainSec = Math.max(0, Math.floor(remainMs / 1000));

  let color = 'text-sky-600';
  if (remainMs <= 5 * 60 * 1000 && remainMs > 0) color = 'text-amber-600';
  if (remainMs <= 0) color = 'text-red-600';

  return (
    <span className={`font-mono font-bold text-3xl sm:text-4xl ${color}`}>
      {formatHMS(remainSec)}
    </span>
  );
}

/* ========= Main Page ========= */
export default function Page() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // form
  const [patientName, setPatientName] = useState('');
  const [room, setRoom] = useState('');
  const [bed, setBed] = useState('');
  const [volume, setVolume] = useState('');
  const [dropsPerMl, setDropsPerMl] = useState('20'); // đặt lên trên
  const [dripRate, setDripRate] = useState('');
  const [notes, setNotes] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(false);

  // lists
  const [running, setRunning] = useState<InfusionRow[]>([]);
  const [history, setHistory] = useState<InfusionRow[]>([]);

  // beep
  const [beepEnabled, setBeepEnabled] = useState(true);
  const beepRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => {
    if (!beepRef.current) beepRef.current = new Audio('/alarm.mp3');
  }, []);

  /* —— Auth —— */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user ?? null);
      setLoading(false);
    })();
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  /* —— Tính giờ dự kiến —— */
  const endTimePreview = useMemo(() => {
    const v = toNumber(volume);
    const dpm = toNumber(dripRate);
    const dpmMl = toNumber(dropsPerMl);
    if (!v || !dpm || !dpmMl || dpm <= 0) return null;
    const minutes = (v * dpmMl) / dpm;
    return new Date(Date.now() + minutes * 60_000);
  }, [volume, dripRate, dropsPerMl]);

  /* —— Fetch danh sách —— */
  async function fetchLists() {
    if (!user) return;
    const nowISO = new Date().toISOString();

    const { data: r1 } = (await supabase
      .from('infusions')
      .select('*')
      .eq('user_id', user.id)
      .gte('end_time', nowISO)
      .order('end_time', { ascending: true })) as { data: InfusionRow[] | null };

    const { data: r2 } = (await supabase
      .from('infusions')
      .select('*')
      .eq('user_id', user.id)
      .lt('end_time', nowISO)
      .order('end_time', { ascending: false })) as { data: InfusionRow[] | null };

    setRunning(r1 ?? []);
    setHistory(r2 ?? []);
  }
  useEffect(() => {
    if (!user) return;
    fetchLists();
    const t = setInterval(fetchLists, 15_000);
    return () => clearInterval(t);
  }, [user]);

  /* —— Tạo ca —— */
  const startInfusion = async () => {
    if (!user) return alert('Vui lòng đăng nhập');
    const v = toNumber(volume);
    const dpm = toNumber(dripRate);
    const dpmMl = toNumber(dropsPerMl);
    if (!patientName || !room || !bed || !v || !dpm || !dpmMl || dpm <= 0) {
      alert('Vui lòng nhập đủ thông tin hợp lệ.');
      return;
    }
    const now = new Date();
    const minutes = (v * dpmMl) / dpm;
    const end = new Date(now.getTime() + minutes * 60_000);

    const { error } = await supabase.from('infusions').insert({
      user_id: user.id,
      patient_name: patientName.trim(),
      room: room.trim(),
      bed: bed.trim(),
      volume: v,
      drip_rate_dpm: dpm,
      drops_per_ml: dpmMl,
      notes: notes.trim() || null,
      start_time: now.toISOString(),
      end_time: end.toISOString(),
      notify_email: notifyEmail,
    });
    if (error) {
      alert('Lỗi lưu ca truyền. Vui lòng thử lại.');
      return;
    }
    setPatientName(''); setRoom(''); setBed('');
    setVolume(''); setDripRate(''); setNotes(''); setNotifyEmail(false);
    await fetchLists();
  };

  /* ========= UI ========= */
  if (loading) return <div className="p-6">Đang tải…</div>;

  /* —— Màn đăng nhập —— */
  if (!user) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-blue-600 to-sky-500 text-white flex items-center justify-center px-6">
        <SwRegister />
        <div className="w-full max-w-sm text-center">
          <img
            src="/icons/icon-512x512.png"
            alt="AP Truyền dịch"
            width={128}
            height={128}
            className="mx-auto w-28 h-28 rounded-2xl shadow-xl ring-2 ring-white/20"
          />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight">AP - Truyendich</h1>
          <p className="mt-3 opacity-95">
            Ứng dụng tính thời gian truyền dịch cho điều dưỡng - bệnh viện An Phước
          </p>
          <p className="mt-1 text-sm opacity-90">Vui lòng đăng nhập</p>
          <button
            onClick={signIn}
            className="mt-6 w-full py-3 rounded-xl bg-white text-blue-700 font-semibold shadow-lg hover:shadow-xl active:scale-[0.99] transition"
          >
            Đăng nhập
          </button>
        </div>
      </main>
    );
  }

  /* —— Trang chính —— */
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <SwRegister />

      {/* PHẦN 1: Tiêu đề & đăng nhập */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-800">AP - Truyendich</h1>
            <div className="text-xs text-slate-500">Đăng nhập: {user.email ?? '...'}</div>
          </div>
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input type="checkbox" checked={beepEnabled} onChange={(e) => setBeepEnabled(e.target.checked)} />
              Âm thanh khi app đang mở
            </label>
            <button
              onClick={signOut}
              className="px-3 py-2 rounded-md border border-red-300 text-red-600 hover:bg-red-50 text-sm"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pb-12">

        {/* PHẦN 2: Thông tin nhập */}
        <section className="mt-4 rounded-xl border bg-white shadow-sm p-4">
          <h2 className="text-lg font-semibold text-slate-800 mb-3">Tạo ca truyền</h2>

          {/* mỗi trường 1 hàng – mobile first */}
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Bệnh nhân</label>
              <input
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="VD: Phạm Văn A"
                className="w-full rounded-lg border px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phòng</label>
              <input
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="VD: 305"
                className="w-full rounded-lg border px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Giường</label>
              <input
                value={bed}
                onChange={(e) => setBed(e.target.value)}
                placeholder="VD: 12B"
                className="w-full rounded-lg border px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Thể tích (ml)</label>
              <input
                value={volume}
                onChange={(e) => setVolume(e.target.value)}
                placeholder="VD: 500"
                inputMode="numeric"
                className="w-full rounded-lg border px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Số giọt/ml</label>
              <input
                value={dropsPerMl}
                onChange={(e) => setDropsPerMl(e.target.value)}
                placeholder="VD: 20"
                inputMode="numeric"
                className="w-full rounded-lg border px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tốc độ truyền (giọt/phút)</label>
              <input
                value={dripRate}
                onChange={(e) => setDripRate(e.target.value)}
                placeholder="VD: 25"
                inputMode="numeric"
                className="w-full rounded-lg border px-4 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-emerald-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Ghi chú (tuỳ chọn)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="..."
                rows={3}
                className="w-full rounded-lg border px-4 py-2 text-[15px] focus:outline-none focus:ring-2 focus:ring-sky-200"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-600">
                {endTimePreview ? (
                  <>
                    Kết thúc dự kiến:{' '}
                    <strong className="text-slate-800">
                      {endTimePreview.toLocaleTimeString()} {endTimePreview.toLocaleDateString()}
                    </strong>
                  </>
                ) : (
                  '—'
                )}
              </div>

              <label className="inline-flex items-center gap-2 text-[15px]">
                <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
                Nhận email khi ca kết thúc
              </label>
            </div>

            <div className="pt-1">
              <button
                onClick={startInfusion}
                className="w-full md:w-auto px-6 py-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                Bắt đầu truyền
              </button>
            </div>
          </div>
        </section>

        {/* PHẦN 3: Danh sách ca truyền */}
        <section className="mt-6 rounded-xl border bg-white shadow-sm p-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-3">Danh sách ca truyền (đang chạy)</h3>

          {running.length === 0 ? (
            <div className="text-slate-500 text-sm">Không có ca đang chạy.</div>
          ) : (
            <ul className="space-y-3">
              {running.map((r) => {
                const end = new Date(r.end_time).getTime();
                const left = end - Date.now();
                const ended = left <= 0;

                return (
                  <li
                    key={r.id}
                    className="rounded-lg border p-3 flex items-center justify-between bg-gradient-to-r from-white to-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate">{r.patient_name}</div>
                      <div className="text-xs text-slate-500">
                        Phòng {r.room} – Giường {r.bed} • Kết thúc:{' '}
                        {new Date(r.end_time).toLocaleTimeString()} {new Date(r.end_time).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="shrink-0 text-right pl-3">
                      <Countdown endISO={r.end_time} />
                      <div className={`text-xs ${ended ? 'text-red-600' : 'text-emerald-600'}`}>
                        {ended ? 'đã hết thời gian' : 'đang truyền'}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* PHẦN 4: Lịch sử */}
        <section className="mt-6 rounded-xl border bg-white shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-slate-800">Lịch sử ca truyền</h3>
            <button
              onClick={async () => {
                if (!user) return;
                if (!confirm('Xóa toàn bộ lịch sử?')) return;
                await supabase
                  .from('infusions')
                  .delete()
                  .eq('user_id', user.id)
                  .lt('end_time', new Date().toISOString());
                await fetchLists();
              }}
              className="px-3 py-2 rounded-md border border-red-300 text-red-600 hover:bg-red-50 text-sm"
            >
              Xóa toàn bộ lịch sử
            </button>
          </div>

          {history.length === 0 ? (
            <div className="text-slate-500 text-sm">Chưa có lịch sử.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Bệnh nhân</th>
                    <th className="py-2 pr-3">Phòng - Giường</th>
                    <th className="py-2 pr-3">Kết thúc</th>
                    <th className="py-2">Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{h.patient_name}</td>
                      <td className="py-2 pr-3">
                        {h.room} - {h.bed}
                      </td>
                      <td className="py-2 pr-3">
                        {new Date(h.end_time).toLocaleTimeString()} {new Date(h.end_time).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-emerald-600">đã kết thúc</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-slate-500 mt-8">Phát triển: Điều dưỡng An Phước</p>
      </div>

      <audio ref={beepRef} preload="auto" src="/alarm.mp3" />
    </main>
  );
}
