import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

type Profile = { id: string; email: string | null; full_name: string | null; created_at: string };
type AuthState =
  | { status: "loading" }
  | { status: "unauthenticated" }
  | { status: "authenticated"; user: NonNullable<import("@supabase/supabase-js").User>; profile: Profile | null };

type Ctx = {
  state: AuthState;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
};

const AuthCtx = createContext<Ctx | undefined>(undefined);

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("id,email,full_name,created_at").eq("id", userId).maybeSingle();
  if (error) {
    console.warn("loadProfile error", error);
  }
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });

  // 1) Lần tải đầu: exchange code -> session (nếu có) rồi set state
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.auth.getSession(); // auto exchange PKCE code nếu có trong URL
      if (!mounted) return;
      if (error) {
        console.error("getSession error", error);
        setState({ status: "unauthenticated" });
        return;
      }
      if (data.session?.user) {
        const profile = await loadProfile(data.session.user.id);
        setState({ status: "authenticated", user: data.session.user, profile });
      } else {
        setState({ status: "unauthenticated" });
      }
    })();

    // 2) Lắng nghe thay đổi auth sau này
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_IN" && session?.user) {
        const profile = await loadProfile(session.user.id);
        setState({ status: "authenticated", user: session.user, profile });
      } else if (event === "SIGNED_OUT") {
        setState({ status: "unauthenticated" });
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signInWithGoogle() {
    const redirectTo = window.location.origin; // quay lại đúng domain Netlify
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error) console.error("signInWithGoogle error", error);
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("signOut error", error);
  }

  async function refreshSession() {
    await supabase.auth.getSession();
  }

  const value = useMemo<Ctx>(
    () => ({ state, signInWithGoogle, signOut, refreshSession }),
    [state]
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
