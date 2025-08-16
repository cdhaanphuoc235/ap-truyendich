'use client';

import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

type Props = { userId: string };

export default function InfusionForm({ userId }: Props) {
  const [patientName, setPatientName] = useState('');
  const [room, setRoom] = useState('');
  const [bed, setBed] = useState('');
  const [volumeMl, setVolumeMl] = useState<number | ''>('');
  const [dripRate, setDripRate] = useState<number | ''>('');      // giọt/phút
  const [dropsPerMl, setDropsPerMl] = useState<number | ''>(20);  // giọt/ml
  const [notes, setNotes] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(false);
  const [saving, setSaving] = useState(false);

  const calcMinutes = (vMl: number, dpm: number, dpmMl: number) =>
    (vMl * dpmMl) / dpm;

  const handleStart = async () => {
    const v = Number(volumeMl);
    const r = Number(dripRate);
    const g = Number(dropsPerMl || 20);

    if (!patientName.trim()) { alert('Vui lòng nhập Tên bệnh nhân'); return; }
    if (!v || v <= 0) { alert('Thể tích (ml) phải > 0'); return; }
    if (!r || r <= 0) { alert('Tốc độ (giọt/phút) phải > 0'); return; }
    if (!g || g <= 0) { alert('Số giọt/ml phải > 0'); return; }

    const minutes = calcMinutes(v, r, g);
    const start = new Date();
    const end = new Date(start.getTime() + minutes * 60_000);

    setSaving(true);
    const { error } = await supabase.from('infusions').insert({
      user_id: userId,
      patient_name: patientName.trim(),
      room: room.trim() || null,
      bed: bed.trim() || null,
      volume_ml: v,
      drip_rate_dpm: r,
      drops_per_ml: g,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      notify_email: notifyEmail,
      status: 'scheduled',
      notes: notes || null,
    });
    setSaving(false);

    if (error) { alert(error.message); return; }

    // reset form
    setPatientName(''); setRoom(''); setBed('');
    setVolumeMl(''); setDripRate(''); setDropsPerMl(20);
    setNotes(''); setNotifyEmail(false);

    window.dispatchEvent(new CustomEvent('infusion:created'));
  };

  return (
    <div className="card mt-3">
      <div className="card-body">
        <h5 className="card-title">Tạo ca truyền</h5>

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label">Bệnh nhân</label>
            <input className="form-control" value={patientName}
                   onChange={e=>setPatientName(e.target.value)} placeholder="Ví dụ: Phạm Văn A" />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label">Phòng</label>
            <input className="form-control" value={room}
                   onChange={e=>setRoom(e.target.value)} placeholder="Ví dụ: 305" />
          </div>

          <div className="col-6 col-md-3">
            <label className="form-label">Giường</label>
            <input className="form-control" value={bed}
                   onChange={e=>setBed(e.target.value)} placeholder="Ví dụ: 12B" />
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Thể tích thuốc (ml)</label>
            <input type="number" inputMode="decimal" className="form-control"
                   value={volumeMl} onChange={e=>setVolumeMl(e.target.value === '' ? '' : Number(e.target.value))}
                   placeholder="Ví dụ: 500" />
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Tốc độ truyền (giọt/phút)</label>
            <input type="number" inputMode="decimal" className="form-control"
                   value={dripRate} onChange={e=>setDripRate(e.target.value === '' ? '' : Number(e.target.value))}
                   placeholder="Ví dụ: 25" />
          </div>

          <div className="col-12 col-md-4">
            <label className="form-label">Số giọt/ml (giọt/ml)</label>
            <input type="number" inputMode="decimal" className="form-control"
                   value={dropsPerMl} onChange={e=>setDropsPerMl(e.target.value === '' ? '' : Number(e.target.value))}
                   placeholder="Mặc định 20" />
          </div>

          <div className="col-12">
            <label className="form-label">Ghi chú</label>
            <textarea className="form-control" rows={2} value={notes} onChange={e=>setNotes(e.target.value)} />
          </div>

          <div className="col-12">
            <div className="form-check">
              <input className="form-check-input" type="checkbox" id="notifyEmail"
                     checked={notifyEmail} onChange={e=>setNotifyEmail(e.target.checked)} />
              <label htmlFor="notifyEmail" className="form-check-label">Nhận email khi ca kết thúc</label>
            </div>
          </div>
        </div>

        <button className="btn btn-primary mt-3" onClick={handleStart} disabled={saving}>
          {saving ? 'Đang lưu...' : 'Bắt đầu truyền'}
        </button>
      </div>
    </div>
  );
}
