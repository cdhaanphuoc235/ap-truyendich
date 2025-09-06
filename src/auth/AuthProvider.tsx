// src/auth/AuthProvider.tsx
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | undefined>(undefined);
export const useAuth = () => {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
};

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // 1) Luôn thử exchange code ở BẤT KỲ URL nào có ?code=..., không phụ thuộc /auth/callback
  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const hasCode = url.searchParams.get("code");
        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          if (error) console.error("[auth] exchangeCodeForSession error:", error);
          // dọn URL cho sạch
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          window.history.replaceState({}, "", url.toString());
        }
      } catch (e) {
        console.error("[auth] exchange failed:", e);
      }
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setLoading(false);
    })();
  }, []);

  // 2) Đồng bộ realtime state
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(() => ({
    user: session?.user ?? null,
    session,
    loading,
    async signInWithGoogle() {
      const redirectTo = window.location.origin; // có thể trả về /?code=..., ta đã handle ở trên
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "consent", access_type: "offline" }
        }
      });
      if (error) console.error("[auth] signInWithOAuth error:", error);
    },
    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) console.error("[auth] signOut error:", error);
    }
  }), [session, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
