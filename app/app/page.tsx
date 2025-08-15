'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createClient, SupabaseClient, User } from '@supabase/supabase-js';

/** ============ Supabase client ============ */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** ============ SW register (giữ yêu cầu <SwRegister />) ============ */
function SwRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const url = '/sw.js';
      navigator.serviceWorker
        .register(url)
        .catch(() => {
          /* ignore */
        });
    }
  }, []);
  return null;
}

/** ============ Kiểu dữ liệu ============ */
type InfusionRow = {
  id: string;
  user_id: string | null;
  patient_name: string | null;
  room: string | null;
  bed: string | null;
  volume: number | null;          // ml
  drip_rate_dpm: number | null;   // giọt/phút
  drops_per_ml: number | null;    // giọt/ml
  notes: string | null;
  start_time: string;             // ISO
  end_time: string;               // ISO
  notify_email: boolean | null;
  email_sent_at: string | null;   // đã gửi email (Edge Function) hay chưa
};

function toNumber(v: string): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** ============ Trang chính ============ */
export default function Page() {
  /** Auth */
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  /** Form state */
  const [patientName, setPatientName] = useState('');
  const [room, setRoom] = useState('');
  const [bed, setBed] = useState('');
  const [volume, setVolume] = useState('');           // ml
  const [dropsPerMl, setDropsPerMl] = useState('20'); // giọt/ml (để TRÊN)
  const [dripRate, setDripRate] = useState('');       // giọt/phút
  const [notes, setNotes] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(false);

  /** UI / âm thanh */
  const [beepEnabled, setBeepEnabled] = useState(true);
  const beepRef = useRef<HTMLAudioElement | null>(null);

  /** Danh sách ca đang chạy & lịch sử */
  const [running, setRunning] = useState<InfusionRow[]>([]);
  const [history, setHistory] = useState<InfusionRow[]>([]);

  /** Tải user */
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user ?? null);
      setLoading(false);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setUser(s?.user ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  /** Tính thời điểm kết thúc dự kiến */
  const endTimePreview = useMemo(() => {
    const v = toNumber(volume);
    const dpm = toNumber(dripRate);
    const dpmMl = toNumber(dropsPerMl);
    if (!v || !dpm || !dpmMl || dpm <= 0) return null;
    // thời gian (phút) = (thể tích * giọt/ml) / (giọt/phút)
    const minutes = (v * dpmMl) / dpm;
    const end = new Date(Date.now() + minutes * 60_000);
    return end;
  }, [volume, dripRate, dropsPerMl]);

  /** Lấy danh sách */
  async function fetchLists() {
    if (!user) return;

    // đang chạy: end_time >= now
    const { data: r1 } = await supabase
      .from('infusions')
      .select('*')
      .eq('user_id', user.id)
      .gte('end_time', new Date().toISOString())
      .order('end_time', { ascending: true }) as { data: InfusionRow[] | null };

    // lịch sử: end_time < now (hiển thị đã kết thúc)
    const { data: r2 } = await supabase
      .from('infusions')
      .select('*')
      .eq('user_id', user.id)
      .lt('end_time', new Date().toISOString())
      .order('end_time', { ascending: false }) as { data: InfusionRow[] | null };

    setRunning(r1 ?? []);
    setHistory(r2 ?? []);
  }

  useEffect(() => {
    if (!user) return;
    fetchLists();

    // refresh mỗi 20s để đếm ngược mượt
    const t = setInterval(fetchLists, 20_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  /** Đăng nhập/Đăng xuất */
  const signIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.href } });
  };
  const signOut = async () => {
    await supabase.auth.signOut();
    // về màn login
    location.reload();
  };

  /** Thêm ca */
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
    // reset form nhẹ
    setPatientName('');
    setRoom('');
    setBed('');
    setVolume('');
    setDripRate('');
    setNotes('');
    // giữ nguyên dropsPerMl & notifyEmail theo thói quen nhập
    await fetchLists();
  };

  /** Phát âm khi bấm test (tùy chọn) */
  useEffect(() => {
    if (!beepRef.current) {
      beepRef.current = new Audio('/alarm.mp3'); // đã có trong public; nếu không có sẽ ignore
    }
  }, []);

  /** Helper hiển thị đồng hồ đếm ngược */
  function renderCountdown(endISO: string) {
    const end = new Date(endISO).getTime();
    const now = Date.now();
    const ms = Math.max(0, end - now);
    const s = Math.floor(ms / 1000);
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss
      .toString()
      .padStart(2, '0')}`;
  }

  /** ================= RENDER ================= */
  if (loading) return <div className="p-6">Đang tải…</div>;

  if (!user) {
    // Màn đăng nhập gọn (màu xanh như yêu cầu cũ)
    return (
      <main className="min-h-screen flex items-center justify-center bg-blue-600 text-white">
        <SwRegister />
        <div className="max-w-md w-full px-6 py-10">
          <div className="text-3xl font-bold mb-2 text-center">AP - Truyendich</div>
          <p className="text-center mb-6">
            Ứng dụng tính thời gian truyền dịch cho điều dưỡng – Bệnh viện An Phước
          </p>
          <button
            onClick={signIn}
            className="w-full py-3 rounded-lg bg-white text-blue-700 font-semibold shadow"
          >
            Đăng nhập bằng Google
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-5">
      <SwRegister />

      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-2xl font-bold">AP - Truyendich</h1>
          <div className="text-sm text-gray-500">Đăng nhập: {user.email ?? '...'}</div>
        </div>

        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={beepEnabled}
              onChange={(e) => setBeepEnabled(e.target.checked)}
            />
            <span>Âm thanh khi app đang mở</span>
          </label>

          <button
            onClick={signOut}
            className="px-3 py-2 rounded border border-red-300 text-red-600 hover:bg-red-50"
          >
            Đăng xuất
          </button>
        </div>
      </div>

      {/* Form */}
      <section className="rounded-lg border p-4 mb-6">
        <h2 className="text-xl font-semibold mb-4">Tạo ca truyền</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bệnh nhân */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Bệnh nhân</label>
            <input
              value={patientName}
              onChange={(e) => setPatientName(e.target.value)}
              placeholder="VD: Phạm Văn A"
              className="w-full rounded border px-3 py-2"
            />
          </div>

          {/* Phòng / Giường */}
          <div>
            <label className="block text-sm font-medium mb-1">Phòng</label>
            <input
              value={room}
              onChange={(e) => setRoom(e.target.value)}
              placeholder="VD: 305"
              className="w-full rounded border px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Giường</label>
            <input
              value={bed}
              onChange={(e) => setBed(e.target.value)}
              placeholder="VD: 12B"
              className="w-full rounded border px-3 py-2"
            />
          </div>

          {/* Thể tích */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Thể tích (ml)</label>
            <input
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              placeholder="VD: 500"
              inputMode="numeric"
              className="w-full rounded border px-3 py-2"
            />
          </div>

          {/* >>> THAY ĐỔI THỨ TỰ: Số giọt/ml đặt TRƯỚC Tốc độ truyền <<< */}
          <div>
            <label className="block text-sm font-medium mb-1">Số giọt/ml</label>
            <input
              value={dropsPerMl}
              onChange={(e) => setDropsPerMl(e.target.value)}
              placeholder="VD: 20"
              inputMode="numeric"
              className="w-full rounded border px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Tốc độ truyền (giọt/phút)</label>
            <input
              value={dripRate}
              onChange={(e) => setDripRate(e.target.value)}
              placeholder="VD: 25"
              inputMode="numeric"
              className="w-full rounded border px-3 py-2"
            />
          </div>

          {/* Ghi chú */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-1">Ghi chú</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="..."
              rows={4}
              className="w-full rounded border px-3 py-2"
            />
          </div>

          {/* Cài đặt & nút */}
          <div className="md:col-span-2 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {endTimePreview ? (
                <>
                  Kết thúc dự kiến:{' '}
                  <strong>
                    {endTimePreview.toLocaleTimeString()} {endTimePreview.toLocaleDateString()}
                  </strong>
                </>
              ) : (
                '—'
              )}
            </div>

            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
              />
              <span>Nhận email khi ca kết thúc</span>
            </label>
          </div>

          <div className="md:col-span-2">
            <button
              onClick={startInfusion}
              className="w-full md:w-auto px-5 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              Bắt đầu truyền
            </button>
          </div>
        </div>
      </section>

      {/* Danh sách ca đang chạy */}
      <section className="rounded-lg border p-4 mb-6">
        <h3 className="font-semibold mb-3">Danh sách ca truyền (đang chạy)</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b">
                <th className="py-2 pr-3">Bệnh nhân</th>
                <th className="py-2 pr-3">Phòng - Giường</th>
                <th className="py-2 pr-3">Kết thúc</th>
                <th className="py-2">Đếm ngược</th>
              </tr>
            </thead>
            <tbody>
              {running.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-gray-500">
                    Không có ca đang chạy.
                  </td>
                </tr>
              )}
              {running.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{r.patient_name}</td>
                  <td className="py-2 pr-3">
                    {r.room} - {r.bed}
                  </td>
                  <td className="py-2 pr-3">
                    {new Date(r.end_time).toLocaleTimeString()}{' '}
                    {new Date(r.end_time).toLocaleDateString()}
                  </td>
                  <td className="py-2 font-mono">{renderCountdown(r.end_time)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Lịch sử */}
      <section className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Lịch sử ca truyền</h3>
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
            className="px-3 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 text-sm"
          >
            Xóa toàn bộ lịch sử
          </button>
        </div>

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
              {history.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-3 text-gray-500">
                    Chưa có lịch sử.
                  </td>
                </tr>
              )}
              {history.map((h) => (
                <tr key={h.id} className="border-b last:border-0">
                  <td className="py-2 pr-3">{h.patient_name}</td>
                  <td className="py-2 pr-3">
                    {h.room} - {h.bed}
                  </td>
                  <td className="py-2 pr-3">
                    {new Date(h.end_time).toLocaleTimeString()}{' '}
                    {new Date(h.end_time).toLocaleDateString()}
                  </td>
                  <td className="py-2 text-emerald-600">đã kết thúc</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-center text-xs text-gray-500 mt-8">Phát triển: Điều dưỡng An Phước</p>

      {/* âm thanh */}
      <audio ref={beepRef} preload="auto" src="/alarm.mp3" />
    </main>
  );
}
