'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Infusion = {
  id: string; user_id: string;
  patient_name:string; drug_name:string; dose:string|null;
  start_time:string; end_time:string; notes:string|null; status:string;
};

const fmt = (ms:number) => {
  const s = Math.max(0, Math.floor(ms/1000));
  const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), ss = s%60;
  return `${h}h ${m}m ${ss}s`;
};

export default function InfusionList({ userId }: { userId: string }) {
  const [items, setItems] = useState<Infusion[]>([]);

  async function load() {
    const { data, error } = await supabase
      .from('infusions')
      .select('*')
      .eq('user_id', userId)
      .order('end_time', { ascending: true });
    if (!error && data) setItems(data as Infusion[]);
    else {
      // offline fallback
      const local = JSON.parse(localStorage.getItem('infusions') || '[]');
      setItems(local);
    }
  }

  useEffect(() => { load(); }, []);

  // Tick mỗi giây để render countdown
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(()=>setTick(x=>x+1), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="card p-3">
      <h5 className="mb-3">Danh sách ca truyền</h5>
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead><tr><th>Bệnh nhân</th><th>Thuốc</th><th>Kết thúc</th><th>Đếm ngược</th><th>Trạng thái</th></tr></thead>
          <tbody>
            {items.map(it=>{
              const ms = new Date(it.end_time).getTime() - Date.now();
              const ended = ms<=0;
              return (
                <tr key={it.id}>
                  <td>{it.patient_name}</td>
                  <td>{it.drug_name} {it.dose||''}</td>
                  <td>{new Date(it.end_time).toLocaleString()}</td>
                  <td className={ended?'text-danger fw-bold':'text-success'}>{fmt(ms)}</td>
                  <td>{ended?'Đến hạn':'Đang truyền'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
