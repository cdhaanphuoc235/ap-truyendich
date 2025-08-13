'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Row = { id:string; patient_name:string; drug_name:string; end_time:string; status:string };

export default function HistoryPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { location.href = '/login'; return; }
      const { data: infs } = await supabase
        .from('infusions')
        .select('id,patient_name,drug_name,end_time,status')
        .eq('user_id', data.user.id)
        .order('end_time', { ascending: false })
        .limit(100);
      setRows((infs || []) as Row[]);
    });
  }, []);

  return (
    <div className="container py-4">
      <h4>Lịch sử ca truyền</h4>
      <table className="table table-sm">
        <thead><tr><th>Bệnh nhân</th><th>Thuốc</th><th>Kết thúc</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {rows.map(r=>(
            <tr key={r.id}>
              <td>{r.patient_name}</td>
              <td>{r.drug_name}</td>
              <td>{new Date(r.end_time).toLocaleString()}</td>
              <td>{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <a className="btn btn-link p-0" href="/app">← Quay lại</a>
    </div>
  );
}
