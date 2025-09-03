import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function AuthCallback() {
  const [msg, setMsg] = useState("Đang xác thực...");

  useEffect(() => {
    let unsub: (() => void) | undefined;

    (async () => {
      try {
        const href = window.location.href;
        const url = new URL(href);
        const hasCode = !!url.searchParams.get("code");
        const hasHashTokens = /access_token|refresh_token|error_description/i.test(window.location.hash);

        // Nghe sự kiện, nếu có session thì quay về app
        const sub = supabase.auth.onAuthStateChange((_ev, session) => {
          if (session?.user) {
            setMsg("Thành công! Đang chuyển về ứng dụng...");
            window.location.replace("/");
          }
        });
        unsub = () => sub.data.subscription.unsubscribe();

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
          // Implicit: cho supabase đọc hash qua getSession
          await supabase.auth.getSession();
          // Clean hash
          const cleaned = href.split("#")[0];
          window.history.replaceState({}, document.title, cleaned);
        }

        // Chờ tối đa 5s để session hiện diện
        const start = Date.now();
        while (Date.now() - start < 5000) {
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            window.location.replace("/");
            return;
          }
          await sleep(150);
        }

        throw new Error("Không lấy được session sau khi xác thực.");
      } catch (e: any) {
        console.error("[auth-callback] error:", e?.message || e);
        setMsg("Xác thực thất bại. Vui lòng quay lại và thử lại.");
        setTimeout(() => window.location.replace("/"), 2500);
      }
    })();

    return () => {
      if (unsub) unsub();
    };
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
