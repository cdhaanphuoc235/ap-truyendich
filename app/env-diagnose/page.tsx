'use client';
import { useEffect, useState } from 'react';

type R = { ok: boolean; status: number; note: string };

export default function EnvDiagnose() {
  const [result, setResult] = useState<R | null>(null);

  useEffect(() => {
    (async () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      if (!url || !key) {
        setResult({ ok: false, status: 0, note: 'ENV thiếu URL hoặc ANON KEY' });
        return;
      }
      // Không in key ra màn hình để tránh lộ
      try {
        const res = await fetch(`${url}/auth/v1/settings`, {
          headers: { apikey: key }
        });
        setResult({
          ok: res.ok,
          status: res.status,
          note: res.ok ? 'OK - API key hợp lệ' : 'FAIL - Invalid API key/URL'
        });
      } catch (e: any) {
        setResult({ ok: false, status: 0, note: String(e?.message || e) });
      }
    })();
  }, []);

  return (
    <div className="container py-5">
      <h3>Env Diagnose</h3>
      <pre>{JSON.stringify(result, null, 2)}</pre>
      <p className="small">URL: {process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0,40)}...</p>
    </div>
  );
}
