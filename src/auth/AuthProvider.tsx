import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  created_at?: string | null;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthCtx = createContext<AuthState | undefined>(undefined);

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,created_at")
    .eq("id", userId)
    .maybeSingle();
  return (data as Profile) ?? null;
}

async function upsertProfileFromUser(user: User) {
  const full_name =
    (user.user_metadata?.name as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;
  const email = user.email ?? null;
  await supabase.from("profiles").upsert({ id: user.id, email, full_name });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1) Lắng nghe thay đổi session NGAY từ đầu để bắt kịp SIGNED_IN
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      if (newSession?.user) {
        try {
          await upsertProfileFromUser(newSession.user);
          const p = await loadProfile(newSession.user.id);
          setProfile(p);
        } catch (e) {
          console.warn("[auth] profile sync error:", e);
        }
      } else {
        setProfile(null);
      }
    });

    (async () => {
      try {
        const url = new URL(window.location.href);
        const hasCode = !!url.searchParams.get("code");
        const hasOAuthHash = /access_token|refresh_token|error_description/i.test(window.location.hash);

        // 2) PKCE (?code=...) -> exchange rồi clean query
        if (hasCode) {
          const { error } = await supabase.auth.exchangeCodeForSession(window.location.href);
          url.searchParams.delete("code");
          url.searchParams.delete("state");
          const cleaned =
            url.origin + url.pathname + (url.searchParams.toString() ? `?${url.searchParams.toString()}` : "");
          window.history.replaceState({}, document.title, cleaned);
          if (error) console.warn("[auth] exchangeCodeForSession error:", error.message);
        }

        // 3) Luôn gọi getSession để trigger detectSessionInUrl (implicit sẽ được xử lý ở đây)
        const { data } = await supabase.auth.getSession();

        // 4) Sau khi Supabase đã có cơ hội đọc hash -> mới clean hash
        if (hasOAuthHash) {
          const cleaned = window.location.href.split("#")[0];
          window.history.replaceState({}, document.title, cleaned);
        }

        // 5) Cập nhật state lần đầu
        setSession(data.session ?? null);
        if (data.session?.user) {
          await upsertProfileFromUser(data.session.user);
          const p = await loadProfile(data.session.user.id);
          setProfile(p);
        }
      } finally {
        setLoading(false);
      }
    })();

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    const redirectTo = window.location.origin + "/";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
        flowType: "pkce" // Ưu tiên PKCE cho web
      }
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      signInWithGoogle,
      signOut
    }),
    [session, profile, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
