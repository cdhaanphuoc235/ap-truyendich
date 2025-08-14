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
  end_time: string | null;
  status: string | null;
};

export default function HistoryList({ userId }: Props) {
  const supabase = getSupabase();
  const [rows, setRows] = useState<Infusion[]>([]);
  const [now, setNow] = useState<number>(Date.now());
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data, error } = await supabase
      .from('infusions')
      .select('id,user_id,patient_name,room,bed,end_time,status')
      .eq('user_id', userId)
      .order('end_time', { ascending: false })
      .limit(500);
    if (!error) setRows(data as any);
  };

  useEffect(() => {
    load();
    const onCreated = () => load();
    const onDeleted = () => load();
    window.addEventListener('infusion:created', onCreated);
    window.addEventListener('infusion:deleted', onDeleted);
    const t = setInterval(() => setNow(Date.now()), 10_000);
    return () => {
      window.removeEventListener('infusion:created', onCreated);
      window.removeEventListener('infusion:deleted', onDeleted);
      clearInterval(t);
    };
  }, []);

  // ca đã kết thúc = (hết giờ) hoặc (status đã notified/done)
  const endedFilter = (r: Infusion) => {
    const end = r.end_time ? new Date(r.end_time).getTime() : 0;
    const endedByTime = end > 0 && end <= now;
    const st = (r.status || '').toLowerCase();
    const endedByStatus = st === 'notified' || st === 'done';
    return endedByTime || endedByStatus;
  };

  const items = useMemo(() => (rows || []).filter(endedFilter), [rows, now]);

  const deleteAllHistory = async () => {
    if (busy) return;
    // Đếm trước để xác nhận
    const nowIso = new Date().toISOString();
    const { count } = await supabase
      .from('infusions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .or(`end_time.lte.${nowIso},status.eq.notified,status.eq.done`);

    const n = count ?? 0;
    if (n === 0) { alert('Không có bản ghi lịch sử để xóa.'); return; }
    if (!confirm(`Xóa toàn bộ ${n} ca trong lịch sử? Hành động không thể hoàn tác.`)) return;

    setBusy(true);
    const { error } = await supabase
      .from('infusions')
      .delete()
      .eq('user_id', userId)
      .or(`end_time.lte.${nowIso},status.eq.notified,status.eq.done`);

    setBusy(false);
    if (error) { alert(error.message); return; }
    window.dispatchEvent(new CustomEvent('infusion:deleted'));
  };

  return (
    <div className="card mt-3 mb-4">
      <div className="card-body">
        <div className="d-flex align-items-center">
          <h5 className="card-title mb-0">Lịch sử ca truyền</h5>
          <button
            className="btn btn-outline-danger btn-sm ms-auto"
            onClick={deleteAllHistory}
            disabled={busy}
            title="Xóa toàn bộ lịch sử đã kết thúc"
          >
            {busy ? 'Đang xóa...' : 'Xóa toàn bộ lịch sử'}
          </button>
        </div>

        <div className="table-responsive mt-2">
          <table className="table table-sm align-middle">
            <thead>
              <tr>
                <th>Bệnh nhân</th>
                <th className="d-none d-sm-table-cell">Phòng - Giường</th>
                <th>Kết thúc</th>
                <th className="d-none d-md-table-cell">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={4} className="text-muted">Chưa có lịch sử.</td></tr>
              )}
              {items.map(r => {
                const end = r.end_time ? new Date(r.end_time) : null;
                return (
                  <tr key={r.id}>
                    <td>{r.patient_name || '-'}</td>
                    <td className="d-none d-sm-table-cell">{[r.room, r.bed].filter(Boolean).join(' - ') || '-'}</td>
                    <td>{end ? end.toLocaleString() : '-'}</td>
                    <td className="d-none d-md-table-cell"><span className="text-success">đã kết thúc</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-muted small mb-0">Chỉ xóa lịch sử khi không còn cần đối chiếu.</p>
      </div>
    </div>
  );
}
