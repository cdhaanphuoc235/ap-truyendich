'use client';
import { supabase } from '@/lib/supabase';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import PushToggle from './push-toggle';
import InfusionForm from './infusion-form';
import InfusionList from './infusion-list';
import InstallPrompt from '../install-prompt';

export default function AppPage() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

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

      {/* Nút cài PWA */}
      <InstallPrompt />

      <PushToggle userId={session.user.id} />
      <InfusionForm userId={session.user.id} />
      <hr />
      <InfusionList userId={session.user.id} />
    </div>
  );
}
