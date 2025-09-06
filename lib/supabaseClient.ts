// src/lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !anon) {
  throw new Error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(url, anon, {
  auth: {
    flowType: "pkce",               // dùng PKCE
    detectSessionInUrl: true,       // tự nhận URL code nếu có
    autoRefreshToken: true,
    persistSession: true,
    storageKey: "ap-truyendich-auth"
  },
  // an toàn: thêm apikey header (supabase-js vốn có, nhưng ta set cứng để tránh case bị strip header)
  global: {
    headers: {
      apikey: anon,
      "x-client-info": "ap-truyendich-web"
    }
  }
});
