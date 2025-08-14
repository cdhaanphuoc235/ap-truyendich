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
  volume_ml: number | null;
  drip_rate_dpm: number | null;
  drops_per_ml: number | null;
  start_time: string | null;
  end_time: string | null;
  status: string | null;
};

function formatDuration(ms: number) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}:${ss.toString().padStart(2,'0')}`;
}

export default function InfusionList({ userId }: Props) {
  const supabase = getSupabase();
  const [rows, setRows] = useState<Infusion[]>([]);
  const [now, setNow] = useState<number>(Date.now());

  const load = async () => {
    const { data, error } = await supabase
      .from('infusions')
      .select('*')
      .eq('user_id', userId)
      .order('start_time', { ascending: false })
      .limit(100);
    if (!error) setRows(data as any);
  };

  useEffect(() => {
    load();
    const onCreated = () => load();
    window.addEventListener('infusion:created', onCreated);
    const t = setInterval(() => setNow(Date.now()), 1000); // update countdown mỗi giây
    return () => {
      window.removeEventListener('infusion:created', onCreated);
      clearInterval(t);
    };
  }, []);

  const items = useMemo(() => rows.map(r => {
    const end = r.end_time ? new Date(r.end_time).getTime() : 0;
    const remain = end - now;
    return { ...r, remain, endDate: end ? new Date(end) : null };
  }), [rows, now]);

  return (
    <div className="card mt-3">
      <div className="card-body">
        <h5 className="card-title">Danh sách ca truyền</h5>
        <div className="table-responsive">
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
                <tr><td colSpan={5} className="text-muted">Chưa có ca nào.</td></tr>
              )}
              {items.map(r => (
                <tr key={r.id}>
                  <td>{r.patient_name || '-'}</td>
                  <td>{[r.room, r.bed].filter(Boolean).join(' - ') || '-'}</td>
                  <td>{r.endDate ? r.endDate.toLocaleString() : '-'}</td>
                  <td>
                    <span className={r.remain <= 0 ? 'text-danger fw-bold' : ''}>
                      {formatDuration(r.remain)}
                    </span>
                  </td>
                  <td>{r.status || 'scheduled'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
