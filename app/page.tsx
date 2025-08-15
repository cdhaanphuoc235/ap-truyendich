'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- Supabase browser client (giữ nguyên env bạn đang có trên Netlify) ---
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const sb = createClient(supabaseUrl, supabaseAnonKey);

// Kiểu dữ liệu form
type FormState = {
  patient_name: string;
  room: string;
  bed: string;
  volume: number | '' ;           // ml
  drip_rate_dpm: number | '';     // giọt/phút
  drops_per_ml: number | '';      // giọt/ml (mặc định 20)
  notes: string;
  notify_email: boolean;
};

// Tính thời gian kết thúc (phút) theo công thức
const calcMinutes = (volume: number, dripRate: number, dropsPerMl: number) => {
  if (!volume || !dripRate || !dropsPerMl) return 0;
  return Math.round((volume * dropsPerMl) / dripRate);
};

export default function Page() {
  // Thông tin người dùng (để hiện email + logout)
  const [userEmail, setUserEmail] = useState<string>('');

  // Trạng thái âm thanh khi app mở (giữ nguyên id & cấu trúc để code cũ dùng)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Form
  const [form, setForm] = useState<FormState>({
    patient_name: '',
    room: '',
    bed: '',
    volume: '',
    drip_rate_dpm: '',
    drops_per_ml: 20,
    notes: '',
    notify_email: false,
  });

  // Tính trước phút và giờ kết thúc hiển thị ngay cho người dùng
  const minutes = useMemo(() => {
    const v = Number(form.volume || 0);
    const r = Number(form.drip_rate_dpm || 0);
    const d = Number(form.drops_per_ml || 0);
    return calcMinutes(v, r, d);
  }, [form.volume, form.drip_rate_dpm, form.drops_per_ml]);

  const previewEndTime = useMemo(() => {
    if (!minutes) return '';
    const d = new Date(Date.now() + minutes * 60 * 1000);
    return d.toLocaleString();
  }, [minutes]);

  // Lấy thông tin user hiện tại để hiển thị email
  useEffect(() => {
    sb.auth.getUser().then((res) => {
      const email = res.data.user?.email || '';
      setUserEmail(email);
    });
  }, []);

  const onChange = (field: keyof FormState, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleLogout = async () => {
    await sb.auth.signOut();
    window.location.reload();
  };

  // Submit: gọi đúng API/DB của bạn như trước đây
  const handleStart = async () => {
    // Validate nhẹ
    if (!form.patient_name || !form.room || !form.bed) {
      alert('Vui lòng nhập đầy đủ: Bệnh nhân / Phòng / Giường.');
      return;
    }
    if (!form.volume || !form.drip_rate_dpm || !form.drops_per_ml) {
      alert('Vui lòng nhập Thể tích, Tốc độ truyền và Số giọt/ml.');
      return;
    }

    // Tính giờ kết thúc
    const mins = calcMinutes(
      Number(form.volume),
      Number(form.drip_rate_dpm),
      Number(form.drops_per_ml)
    );
    const end = new Date(Date.now() + mins * 60 * 1000);

    // Lấy user_id để lưu (email gửi về chính account đăng nhập)
    const { data: { user } } = await sb.auth.getUser();

    // Insert như code hiện tại của bạn (đặt đúng tên cột hiện có)
    const { error } = await sb
      .from('infusions')
      .insert({
        user_id: user?.id ?? null,
        patient_name: form.patient_name.trim(),
        room: form.room.trim(),
        bed: form.bed.trim(),
        volume: Number(form.volume),
        drip_rate_dpm: Number(form.drip_rate_dpm),
        drops_per_ml: Number(form.drops_per_ml),
        notes: form.notes?.trim() || null,
        start_time: new Date().toISOString(),
        end_time: end.toISOString(),
        status: 'scheduled',
        notify_email: !!form.notify_email, // <-- quan trọng: lưu đúng cờ người dùng tick
      });

    if (error) {
      console.error(error);
      alert('Lỗi lưu ca truyền. Vui lòng thử lại!');
      return;
    }

    // Reset form đơn giản
    setForm((prev) => ({
      ...prev,
      patient_name: '',
      room: '',
      bed: '',
      volume: '',
      drip_rate_dpm: '',
      drops_per_ml: prev.drops_per_ml || 20,
      notes: '',
      notify_email: prev.notify_email, // giữ nguyên tick theo thói quen người dùng
    }));
  };

  return (
    <div className="container py-3">

      {/* HEADER */}
      <div className="d-flex align-items-center justify-content-between mb-3">
        <div className="d-flex align-items-start">
          <div>
            <h3 className="mb-1 fw-bold">AP - Truyendich</h3>
            <small className="text-muted">
              Đăng nhập:
              {' '}
              <strong>{userEmail || '...'}</strong>
            </small>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* Bật/Tắt âm thanh khi app mở (giữ lại để code cũ đọc state này nếu cần) */}
          <div className="form-check form-switch me-2">
            <input
              id="sound-switch"
              className="form-check-input"
              type="checkbox"
              role="switch"
              checked={soundEnabled}
              onChange={(e) => setSoundEnabled(e.target.checked)}
            />
            <label className="form-check-label" htmlFor="sound-switch">
              Âm thanh khi app đang mở
            </label>
          </div>

          {/* Đăng xuất */}
          <button className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
            Đăng xuất
          </button>
        </div>
      </div>

      {/* FORM TẠO CA TRUYỀN */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h5 className="card-title mb-3">Tạo ca truyền</h5>

          {/* Hàng 1: Bệnh nhân / Phòng / Giường */}
          <div className="row g-3">
            <div className="col-12 col-md-4">
              <label className="form-label">Bệnh nhân</label>
              <input
                className="form-control"
                placeholder="VD: Phạm Văn A"
                value={form.patient_name}
                onChange={(e) => onChange('patient_name', e.target.value)}
              />
            </div>

            <div className="col-6 col-md-4">
              <label className="form-label">Phòng</label>
              <input
                className="form-control"
                placeholder="VD: 305"
                value={form.room}
                onChange={(e) => onChange('room', e.target.value)}
              />
            </div>

            <div className="col-6 col-md-4">
              <label className="form-label">Giường</label>
              <input
                className="form-control"
                placeholder="VD: 12B"
                value={form.bed}
                onChange={(e) => onChange('bed', e.target.value)}
              />
            </div>
          </div>

          {/* Hàng 2: Thể tích / Tốc độ / Số giọt/ml */}
          <div className="row g-3 mt-1">
            <div className="col-12 col-md-4">
              <label className="form-label">Thể tích (ml)</label>
              <input
                type="number"
                min={0}
                className="form-control"
                placeholder="VD: 500"
                value={form.volume}
                onChange={(e) => onChange('volume', e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

            <div className="col-6 col-md-4">
              <label className="form-label">Tốc độ truyền (giọt/phút)</label>
              <input
                type="number"
                min={1}
                className="form-control"
                placeholder="VD: 25"
                value={form.drip_rate_dpm}
                onChange={(e) => onChange('drip_rate_dpm', e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>

            <div className="col-6 col-md-4">
              <label className="form-label">Số giọt/ml</label>
              <input
                type="number"
                min={1}
                className="form-control"
                placeholder="VD: 20"
                value={form.drops_per_ml}
                onChange={(e) => onChange('drops_per_ml', e.target.value === '' ? '' : Number(e.target.value))}
              />
            </div>
          </div>

          {/* Ghi chú */}
          <div className="mt-3">
            <label className="form-label">Ghi chú</label>
            <textarea
              className="form-control"
              rows={3}
              placeholder="..."
              value={form.notes}
              onChange={(e) => onChange('notes', e.target.value)}
            />
          </div>

          {/* Hàng 3: Checkbox + nút Bắt đầu + xem giờ kết thúc */}
          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between mt-3">
            <div className="form-check">
              <input
                id="notify-email"
                className="form-check-input"
                type="checkbox"
                checked={form.notify_email}
                onChange={(e) => onChange('notify_email', e.target.checked)}
              />
              <label className="form-check-label" htmlFor="notify-email">
                Nhận email khi ca kết thúc
              </label>
            </div>

            <div className="d-flex align-items-center gap-3 mt-2 mt-md-0">
              {minutes > 0 && (
                <small className="text-muted">
                  Kết thúc dự kiến: <strong>{previewEndTime}</strong> ({minutes} phút)
                </small>
              )}
              <button className="btn btn-primary px-4" onClick={handleStart}>
                Bắt đầu truyền
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* DANH SÁCH CA TRUYỀN ĐANG CHẠY – giữ nguyên id/khung để code hiện tại tiếp tục fill */}
      <div className="card shadow-sm mb-3">
        <div className="card-body">
          <h5 className="card-title mb-3">Danh sách ca truyền (đang chạy)</h5>
          <div id="running-list">
            {/* Phần render danh sách đang chạy của bạn sẽ gắn vào đây */}
            <div className="text-muted">Không có ca đang chạy.</div>
          </div>
        </div>
      </div>

      {/* LỊCH SỬ CA TRUYỀN – giữ nguyên cấu trúc để code cũ fill */}
      <div className="card shadow-sm mb-5">
        <div className="card-body">
          <div className="d-flex align-items-center justify-content-between mb-2">
            <h5 className="card-title mb-0">Lịch sử ca truyền</h5>
            <button id="clear-history" className="btn btn-outline-danger btn-sm">
              Xoá toàn bộ lịch sử
            </button>
          </div>
          <div id="history-list">
            {/* Phần render lịch sử của bạn sẽ gắn vào đây */}
            <div className="text-muted">Chưa có lịch sử.</div>
          </div>
          <div className="form-text mt-2">Chỉ xoá lịch sử khi không còn cần đối chiếu.</div>
        </div>
      </div>

      <div className="text-center text-muted pb-4">
        <small>Phát triển: <strong>Điều dưỡng An Phước</strong></small>
      </div>
    </div>
  );
}
