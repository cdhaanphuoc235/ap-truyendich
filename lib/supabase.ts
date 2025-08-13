import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * Trả về instance Supabase an toàn (không làm app crash nếu thiếu ENV).
 * - Ưu tiên dùng trong mọi component: const supabase = getSupabase();
 */
export function getSupabase(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!url || !anon) {
    console.error('❌ Missing Supabase env. Check NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY on Netlify.');
    // Tạo client placeholder để tránh throw ngay lúc import
    _client = createClient('https://example.supabase.co', 'invalid');
    return _client;
  }

  _client = createClient(url, anon, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return _client;
}

/** Tương thích code cũ đã import { supabase } */
export const supabase = getSupabase();

/** ESM/CJS interop: cho phép import getSupabase from '@/lib/supabase' */
export default getSupabase;
