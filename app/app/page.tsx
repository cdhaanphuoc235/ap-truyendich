'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import PushToggle from './push-toggle';
import InfusionForm from './infusion-form';
import InfusionList from './infusion-list';
import HistoryList from './history-list';       // <-- thêm
import InstallPrompt from '../install-prompt';
import NotifyClient from './notify-client';

export default function AppPage() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe?.();
  }, [supabase]);

  if (!session) {
    return (
      <div className="container py-5">
        <p>Bạn chưa đăng nhập. <a href="/login">Đăng nhập</a></p>
      </div>
    );
  }

  return (
    <div className="container py-3">
      <div className="d-flex justify-content-between align-items-center">
        <h5 className="mb-0">AP - Truyendich</h5>
        <button className="btn btn-outline-secondary btn-sm"
          onClick={() => supabase.auth.signOut().then(()=>location.href='/login')}>
          Đăng xuất
        </button>
      </div>

      <InstallPrompt />
      <div className="d-flex align-items-center gap-2 mt-2">
        <div className="alert alert-success flex-grow-1 py-2 px-3 mb-0">
          <strong>Thông báo:</strong> <span className="text-success">ĐÃ BẬT</span>
        </div>
        {/* Nút bật/tắt + âm thanh */}
        <div style={{minWidth: 220}}>
          <PushToggle userId={session.user.id} />
        </div>
      </div>

      <InfusionForm userId={session.user.id} />
      <InfusionList userId={session.user.id} />
      <HistoryList userId={session.user.id} />

      <NotifyClient />

      {/* Footer */}
      <footer className="text-center text-muted small py-4">
        Phát triển: <strong>Điều dưỡng An Phước</strong>
      </footer>
    </div>
  );
}
