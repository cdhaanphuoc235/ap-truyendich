'use client';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function LoginPage() {
  const router = useRouter();

  const signIn = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' });
    if (error) alert(error.message);
  };

  useEffect(() => {
    const sub = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) router.push('/app');
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push('/app');
    });
    return () => sub.data.subscription.unsubscribe();
  }, [router]);

  return (
    <div className="container py-5">
      <h3 className="mb-3">Đăng nhập</h3>
      <button className="btn btn-primary" onClick={signIn}>Đăng nhập bằng Google</button>
    </div>
  );
}
