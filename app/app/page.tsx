'use client';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';
import PushToggle from './push-toggle';
import InfusionForm from './infusion-form';
import InfusionList from './infusion-list';
import InstallPrompt from '../install-prompt';
import NotifyClient from './notify-client'; // <-- thêm dòng này

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
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center">
        <h4>AP - Truyendich</h4>
        <button className="btn btn-outline-secondary btn-sm"
          onClick={() => supabase.auth.signOut().then(()=>location.href='/login')}>
          Đăng xuất
        </button>
      </div>

      <InstallPrompt />
      <PushToggle userId={session.user.id} />

      <InfusionForm userId={session.user.id} />
      <InfusionList userId={session.user.id} />

      <NotifyClient /> {/* hiện toast + beep khi app đang mở */}
    </div>
  );
}
