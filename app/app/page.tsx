'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

import SwRegister from '@/app/sw-register';          // 👈 ĐĂNG KÝ SERVICE WORKER (mới)
import InstallPrompt from '../install-prompt';
import NotifyClient from './notify-client';

import PushToggle from './push-toggle';
import InfusionForm from './infusion-form';
import InfusionList from './infusion-list';
import HistoryList from './history-list';

export default function AppPage() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let sub: any;
    (async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setLoading(false);
      sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    })();
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, [supabase]);

  if (loading) {
    return (
      <div className="container py-5">
        <p>Đang tải…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container py-5">
        <SwRegister /> {/* Đảm bảo SW được đăng ký ngay cả khi chưa login */}
        <p>Bạn chưa đăng nhập. <a href="/login">Đăng nhập</a></p>
      </div>
    );
  }

  return (
    <div className="container py-3">
      <SwRegister /> {/* 👈 ĐẶT GẦN ĐẦU TRANG – luôn đăng ký SW khi vào app */}

      {/* Header gọn cho mobile */}
      <div className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">AP - Truyendich</h5>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => supabase.auth.signOut().then(() => (location.href = '/login'))}
        >
          Đăng xuất
        </button>
      </div>

      <InstallPrompt />

      {/* Hàng thông báo + công tắc Push/Sound (thân thiện mobile) */}
      <div className="mt-2">
        <div className="alert alert-success py-2 px-3 mb-2">
          <strong>Thông báo:</strong> <span className="text-success">ĐÃ BẬT</span>
        </div>
        <PushToggle userId={session.user.id} />
      </div>

      {/* Form tạo ca + Danh sách đang chạy + Lịch sử */}
      <InfusionForm userId={session.user.id} />
      <InfusionList userId={session.user.id} />
      <HistoryList userId={session.user.id} />

      {/* In-app toast + beep khi app đang mở */}
      <NotifyClient />

      {/* Footer */}
      <footer className="text-center text-muted small py-4">
        Phát triển: <strong>Điều dưỡng An Phước</strong>
      </footer>
    </div>
  );
}
