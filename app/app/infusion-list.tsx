'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

type Props = { userId: string };

type Infusion = {
  id: string;
  user_id: string;
  patient_name: string | null;
  room: string | null;
  bed: string | null;
  start_time: string | null;
  end_time: string | null;
};

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`;
}
function formatEnd(end?: Date | null) {
  if (!end) return '-';
  const time = end.toLocaleTimeString('vi-VN', { hour12: false });
  const date = end.toLocaleDateString('vi-VN');
  return `${time} ${date}`;
}
function remainClass(ms: number) {
  if (ms <= 60_000) return 'text-danger';
  if (ms <= 5 * 60_000) return 'text-warning';
  return 'text-success';
}

export default function InfusionList({ userId }: Props) {
  const supabase = getSupabase();
  const [rows, setRows] = useState<Infusion[]>([]);
  const [now, setNow] = useState<number>(Date.now());

  const load = async () => {
    const { data, error } = await supabase
      .from('infusions')
      .select('id,user_id,patient_name,room,bed,start_time,end_time')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(200);
    if (!error) setRows(data as any);
  };

  useEffect(() => {
    load();
    const onCreated = () => load();
    const onDeleted = () => load();
    window.addEventListener('infusion:created', onCreated);
    window.addEventListener('infusion:deleted', onDeleted);
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      window.removeEventListener('infusion:created', onCreated);
      window.removeEventListener('infusion:deleted', onDeleted);
      clearInterval(t);
    };
  }, []);

  // chỉ ca đang chạy
  const items = useMemo(() => {
    return (rows || [])
      .map(r => {
        const end = r.end_time ? new Date(r.end_time).getTime() : 0;
        const remain = end - now;
        return { ...r, remain, endDate: end ? new Date(end) : null };
      })
      .filter(r => r.remain > 0)
      .sort((a, b) => (a.endDate?.getTime() || 0) - (b.endDate?.getTime() || 0));
  }, [rows, now]);

  return (
    <div className="card mt-3">
      <div className="card-body">
        <h5 className="card-title">Danh sách ca truyền (đang chạy)</h5>

        {/* ====== Mobile cards (<576px) ====== */}
        <div className="d-sm-none">
          {items.length === 0 && (
            <div className="text-muted">Không có ca đang chạy.</div>
          )}

          {items.map(r => (
            <div key={r.id} className="border rounded p-3 mb-3">
              <div className="d-flex justify-content-between align-items-start">
                <div>
                  <div className="fw-bold">{r.patient_name || '-'}</div>
                  <div className="text-muted small">
                    Phòng {r.room || '-'} — Giường {r.bed || '-'}
                  </div>
                </div>
                <span className="badge bg-primary">đang truyền</span>
              </div>

              <div className={`mt-2 font-monospace display-6 ${remainClass(r.remain)}`} style={{ lineHeight: 1 }}>
                {formatDuration(r.remain)}
              </div>

              <div className="small mt-1">
                <span className="text-muted">Kết thúc: </span>
                <strong>{formatEnd(r.endDate)}</strong>
              </div>
            </div>
          ))}
        </div>

        {/* ====== Desktop table (≥576px) ====== */}
        <div className="table-responsive d-none d-sm-block">
          <table className="table table-sm align-middle">
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
              {items.length === 0 && (
                <tr><td colSpan={5} className="text-muted">Không có ca đang chạy.</td></tr>
              )}
              {items.map(r => (
                <tr key={r.id}>
                  <td>{r.patient_name || '-'}</td>
                  <td>{[r.room, r.bed].filter(Boolean).join(' - ') || '-'}</td>
                  <td>{formatEnd(r.endDate)}</td>
                  <td>
                    <span className={`fw-bold font-monospace ${remainClass(r.remain)}`}>
                      {formatDuration(r.remain)}
                    </span>
                  </td>
                  <td><span className="text-primary">đang truyền</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
