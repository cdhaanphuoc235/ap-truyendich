import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

type AuthState = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Load initial session
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Listen auth state changes
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
    });
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  // Fetch profile when session changes
  useEffect(() => {
    let active = true;
    (async () => {
      if (session?.user?.id) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id,email,full_name,created_at")
          .eq("id", session.user.id)
          .single();
        if (!active) return;
        if (error) {
          console.warn("Load profile error:", error.message);
          setProfile(null);
        } else {
          setProfile(data as Profile);
        }
      } else {
        setProfile(null);
      }
    })();
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const signInWithGoogle = async () => {
    const redirectTo = window.location.origin; // quay lại app sau login
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } }
    });
    if (error) {
      alert(`Không thể đăng nhập Google: ${error.message}`);
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) alert(`Đăng xuất thất bại: ${error.message}`);
  };

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    loading
      // loading true lúc khởi động để tránh chớp màn
      ,
    signInWithGoogle,
    signOut
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
