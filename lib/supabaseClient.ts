// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

// Lưu ý: các biến này phải được set trong Netlify env:
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  // Không throw để vẫn build được, nhưng log cảnh báo rõ ràng.
  // Nếu thiếu env, app sẽ không thể gọi Supabase khi chạy.
  // Kiểm tra Netlify → Site settings → Environment variables.
  // VITE_AUTH_MODE = supabase (trừ khi đang test mock).
  console.warn(
    "[supabaseClient] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env. " +
      "Set them in Netlify Environment Variables."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
