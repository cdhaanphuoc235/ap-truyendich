'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabase } from '@/lib/supabase';
import SwRegister from '@/app/sw-register';

export default function LoginPage() {
  const router = useRouter();
  const supabase = getSupabase();

  const signIn = async () => {
    const redirectTo = `${location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        flowType: 'pkce',
        queryParams: { prompt: 'consent', access_type: 'offline' },
      },
    });
    if (error) alert(error.message);
  };

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) router.push('/app');
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push('/app');
    });
    return () => sub?.data?.subscription?.unsubscribe?.();
  }, [router, supabase]);

  return (
    <main
      className="min-vh-100 d-flex align-items-center justify-content-center text-center"
      style={{
        background: 'linear-gradient(180deg, #0d6efd 0%, #1e90ff 70%)',
        color: '#fff',
      }}
    >
      <SwRegister />
      <div className="container" style={{ maxWidth: 480 }}>
        <img
          src="/icons/icon-512x512.png"
          alt="AP - Truyendich"
          width={128}
          height={128}
          className="mb-3 rounded-3 shadow"
        />
        <h1 className="fw-bold mb-1">AP - Truyendich</h1>
        <p className="mb-3 opacity-75">
          Ứng dụng tính thời gian truyền dịch cho điều dưỡng — bệnh viện An Phước
        </p>
        <p className="mb-4">Vui lòng đăng nhập</p>

        <button
          className="btn btn-light text-primary btn-lg w-100"
          onClick={signIn}
        >
          Đăng nhập bằng Google
        </button>

        <div className="mt-3">
          <a className="link-light small opacity-75" href="/env-check">
            Kiểm tra ENV
          </a>
        </div>
      </div>
    </main>
  );
}
