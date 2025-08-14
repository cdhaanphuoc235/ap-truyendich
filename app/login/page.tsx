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
      options: { redirectTo, flowType: 'pkce', queryParams: { prompt: 'consent', access_type: 'offline' } }
    });
    if (error) alert(error.message);
  };

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) router.push('/app');
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push('/app');
    });
    return () => sub?.subscription?.unsubscribe?.();
  }, [router, supabase]);

  return (
    <div className="container py-5">
      <SwRegister />
      <h3 className="mb-3">Đăng nhập</h3>
      <button className="btn btn-primary" onClick={signIn}>Đăng nhập bằng Google</button>
      <p className="mt-3"><a href="/env-check">Kiểm tra ENV</a></p>
    </div>
  );
}
