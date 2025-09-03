// src/pages/AuthCallback.tsx
import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function AuthCallback() {
  const [msg, setMsg] = useState("Đang xác thực...");

  useEffect(() => {
    (async () => {
      try {
        const href = window.location.href;
        const url = new URL(href);
        const hasCode = !!url.searchParams.get("code");
        const hasHashTokens = /access_token|refresh_token|error_description/i.test(window.location.hash);

        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(href);
          if (error) throw error;
          // Clean query
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          const cleaned =
            url.origin + url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "");
          window.history.replaceState({}, document.title, cleaned);
        } else if (hasHashTokens) {
          // implicit flow: để supabase đọc hash qua getSession
          await supabase.auth.getSession();
          // Clean hash
          const cleaned = href.split("#")[0];
          window.history.replaceState({}, document.title, cleaned);
        }

        setMsg("Thành công! Đang chuyển về ứng dụng...");
        // Trở lại trang chủ
        window.location.replace("/");
      } catch (e: any) {
        console.error("[auth-callback] error:", e?.message || e);
        setMsg("Xác thực thất bại. Vui lòng quay lại và thử lại.");
        // fallback 3s quay về
        setTimeout(() => window.location.replace("/"), 3000);
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-500 text-white">
      <div className="text-center">
        <div className="text-2xl font-semibold mb-2">Truyền dịch</div>
        <div className="opacity-90">{msg}</div>
      </div>
    </div>
  );
}
