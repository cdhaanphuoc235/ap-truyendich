'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

export default function AuthCallback() {
  const supabase = getSupabase();
  const [status, setStatus] = useState('Đang xử lý đăng nhập…');
  const [details, setDetails] = useState<string>('');

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const search = new URLSearchParams(url.search);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ''));

        // 1) Code flow (PKCE)
        if (search.get('code') || hash.get('code')) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) throw error;
          setStatus('Đăng nhập thành công (code flow). Đang chuyển…');
        } else {
          // 2) Token flow (nếu provider gửi access_token)
          const access_token = search.get('access_token') || hash.get('access_token');
          const refresh_token = search.get('refresh_token') || hash.get('refresh_token');
          if (access_token && refresh_token) {
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
            setStatus('Đăng nhập thành công (token flow). Đang chuyển…');
          } else {
            setStatus('Không tìm thấy code/token trong URL.');
            setDetails(window.location.href);
            return;
          }
        }

        // Dọn URL & chuyển tới /app
        window.history.replaceState({}, '', '/auth/callback');
        setTimeout(() => window.location.replace('/app'), 400);
      } catch (e: any) {
        setStatus('Lỗi khi xử lý đăng nhập');
        setDetails(String(e?.message || e));
        console.error(e);
      }
    })();
  }, [supabase]);

  return (
    <div className="container py-5">
      <h3 className="mb-2">{status}</h3>
      {details && <pre style={{whiteSpace:'pre-wrap'}}>{details}</pre>}
      <p className="mt-3"><a href="/login">← Quay lại đăng nhập</a></p>
    </div>
  );
}
