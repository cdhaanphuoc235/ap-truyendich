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
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let unsub: any;

    const handleOAuth = async () => {
      try {
        const url = new URL(window.location.href);
        const search = new URLSearchParams(url.search);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));

        // 1) Code flow (PKCE)
        const code = search.get('code') || hash.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) { console.error(error); setMsg(error.message); }
          // dọn URL
          ['code','state'].forEach(k => { search.delete(k); hash.delete(k); });
          window.history.replaceState({}, '', url.pathname + (search.toString()?`?${search}`:''));
        }

        // 2) Token flow (nếu provider gửi access_token)
        const access_token = search.get('access_token') || hash.get('access_token');
        const refresh_token = search.get('refresh_token') || hash.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) { console.error(error); setMsg(error.message); }
          ['access_token','refresh_token','expires_in','token_type','provider_token'].forEach(k => {
            search.delete(k); hash.delete(k);
          });
          window.history.replaceState({}, '', url.pathname + (search.toString()?`?${search}`:''));
        }
      } catch (e: any) {
        console.error(e); setMsg(String(e?.message||e));
      }

      // lấy session hiện tại
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      unsub = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
      setLoading(false);
    };

    handleOAuth();
    return () => unsub?.data?.subscription?.unsubscribe?.();
  }, [supabase]);

  if (loading) return <div className="container py-5"><p>Đang xử lý đăng nhập…</p></div>;

  if (!session) {
    return (
      <div className="container py-5">
        <p>Bạn chưa đăng nhập. <a href="/login">Đăng nhập</a></p>
        {msg && <p className="text-danger small mt-3">Lỗi: {msg}</p>}
        <p className="small text-muted">Nếu vừa đăng nhập xong mà vẫn như vậy, kiểm tra <a href="/env-check">ENV</a> hoặc xóa query/hash trên URL rồi thử lại.</p>
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
      <hr />
      <InfusionList userId={session.user.id} />
    </div>
  );
}
