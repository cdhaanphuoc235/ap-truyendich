'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function InfusionForm({ userId }: { userId: string }) {
  const [form, setForm] = useState({
    patient_name: '', drug_name: '', dose: '',
    start_time: '', end_time: '', notes: '', notify_email: false
  });

  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target as any;
    const checked = (e.target as HTMLInputElement).checked;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  async function saveLocalAndSync() {
    // 1) Lưu LocalStorage
    const local = JSON.parse(localStorage.getItem('infusions') || '[]');
    const localItem = { id: `local-${Date.now()}`, user_id: userId, ...form, status: 'scheduled' };
    local.push(localItem);
    localStorage.setItem('infusions', JSON.stringify(local));

    // 2) Đồng bộ Supabase
    const { error } = await supabase.from('infusions').insert({
      user_id: userId,
      patient_name: form.patient_name,
      drug_name: form.drug_name,
      dose: form.dose || null,
      start_time: new Date(form.start_time).toISOString(),
      end_time: new Date(form.end_time).toISOString(),
      notes: form.notes || null,
      notify_email: form.notify_email
    });
    if (error) alert('Lỗi đồng bộ Supabase: ' + error.message);
    else {
      alert('Đã lưu ca truyền!');
      // Reset form đơn giản
      setForm({ patient_name:'', drug_name:'', dose:'', start_time:'', end_time:'', notes:'', notify_email:false });
    }
  }

  return (
    <form className="card p-3 mb-3" onSubmit={(e)=>{e.preventDefault();saveLocalAndSync();}}>
      <h5 className="mb-3">Tạo ca truyền</h5>
      <div className="row g-2">
        <div className="col-md-6">
          <label className="form-label">Bệnh nhân</label>
          <input name="patient_name" value={form.patient_name} className="form-control" required onChange={onChange}/>
        </div>
        <div className="col-md-3">
          <label className="form-label">Thuốc</label>
          <input name="drug_name" value={form.drug_name} className="form-control" required onChange={onChange}/>
        </div>
        <div className="col-md-3">
          <label className="form-label">Liều</label>
          <input name="dose" value={form.dose} className="form-control" onChange={onChange}/>
        </div>
        <div className="col-md-6">
          <label className="form-label">Bắt đầu</label>
          <input type="datetime-local" name="start_time" value={form.start_time} className="form-control" required onChange={onChange}/>
        </div>
        <div className="col-md-6">
          <label className="form-label">Kết thúc</label>
          <input type="datetime-local" name="end_time" value={form.end_time} className="form-control" required onChange={onChange}/>
        </div>
        <div className="col-12">
          <label className="form-label">Ghi chú</label>
          <textarea name="notes" value={form.notes} className="form-control" onChange={onChange}/>
        </div>
        <div className="col-12 form-check mt-2">
          <input id="notify_email" type="checkbox" name="notify_email" checked={form.notify_email} className="form-check-input" onChange={onChange}/>
          <label htmlFor="notify_email" className="form-check-label">Nhận email khi ca kết thúc</label>
        </div>
      </div>
      <button className="btn btn-primary mt-3">Lưu</button>
    </form>
  );
}
