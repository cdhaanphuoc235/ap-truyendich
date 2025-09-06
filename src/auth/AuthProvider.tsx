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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 1) PKCE: nếu URL có ?code=..., đổi code -> session rồi xóa query
  useEffect(() => {
    const url = new URL(window.location.href);
    const hasCode = url.searchParams.get("code");
    const hasError = url.searchParams.get("error_description");
    if (hasCode && !hasError) {
      supabase.auth.exchangeCodeForSession(window.location.href)
        .then(({ data, error }) => {
          if (error) {
            console.error("[auth] exchangeCodeForSession error:", error);
            return;
          }
          setSession(data.session);
          setUser(data.user);
          // Bỏ query để SW không lặp lại
          window.history.replaceState({}, "", "/");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  // 2) Nạp session ban đầu + theo dõi thay đổi
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
    });

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(() => ({
    user,
    session,
    loading,
    signInWithGoogle: async () => {
      const redirectTo = window.location.origin;
      // Dùng PKCE (cast any để tránh mismatch type giữa các version gotrue)
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: { prompt: "select_account" },
        },
        // @ts-ignore
        flowType: "pkce",
      } as any);
    },
    signOut: async () => {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
    },
  }), [user, session, loading]);

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
