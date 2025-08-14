'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase } from '@/lib/supabase';

import PushToggle from './push-toggle';
import InfusionForm from './infusion-form';
import InfusionList from './infusion-list';
import InstallPrompt from '../install-prompt';

export default function AppPage() {
  const supabase = getSupabase();
  const [session, setSession] = useState<Session | null>(null);
  const [handlingOAuth, setHandlingOAuth] = useState(true);

  useEffect(() => {
    let unsub: { subscription?: { unsubscribe?: () => void } } | null = null;

    const handleOAuthCallback = async () => {
      try {
        const url = new URL(window.location.href);

        // 1) Code flow (PKCE): ?code=...&state=...
        if (url.searchParams.get('code')) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) console.error('exchangeCodeForSession error:', error);
          url.searchParams.delete('code');
          url.searchParams.delete('state');
          window.history.replaceState({}, '', url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : ''));
        } else {
          // 2) Token flow: ?access_token=...&refresh_token=...
          const search = new URLSearchParams(url.search);
          const hash = new URLSearchParams(url.hash.replace(/^#/, '')); // phòng khi token ở hash
          const access_token = search.get('access_token') || hash.get('access_token');
          const refresh_token = search.get('refresh_token') || hash.get('refresh_token');

          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) console.error('setSession error:', error);

            // dọn URL
            ['access_token', 'refresh_token', 'expires_in', 'token_type', 'provider_token'].forEach(k => search.delete(k));
            const clean = url.pathname + (search.toString() ? `?${search.toString()}` : '');
            window.history.replaceState({}, '', clean);
          }
        }
      } catch (e) {
        console.error('OAuth handling failed:', e);
      } finally {
        setHandlingOAuth(false);
      }
    };

    handleOAuthCallback().then(async () => {
      // Lấy session sau xử lý callback
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      unsub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    });

    return () => unsub?.subscription?.unsubscribe?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (handlingOAuth) {
    return (
      <div className="container py-5">
        <p>Đang xử lý đăng nhập…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="container py-5">
        <p>Bạn chưa đăng nhập. <a href="/login">Đăng nhập</a></p>
        <p className="small text-muted">Nếu vừa đăng nhập xong mà vẫn thấy trang này, hãy <a href="/env-check">kiểm tra ENV</a>.</p>
      </div>
    );
  }

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center">
        <h4>AP - Truyendich</h4>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={() => supabase.auth.signOut().then(() => (location.href = '/login'))}
        >
          Đăng xuất
        </button>
      </div>

      <InstallPrompt />
      <PushToggle userId={session.user.id} />
      <InfusionForm userId={session.user.id} />
      <hr />
      <InfusionList userId={session.user.id} />
    </div>
  );
}
