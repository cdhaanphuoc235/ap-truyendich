import React, { createContext, useContext, useMemo, useState } from "react";

type Session = { user: { id: string; email: string; user_metadata: Record<string, any> } } | null;
type Profile = { id: string; email: string; full_name: string | null; created_at: string };

type AuthState = {
  session: Session;
  user: Session["user"] | null;
  profile: Profile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export default function MockAuthProvider({ children }: { children: React.ReactNode }) {
  const [logged, setLogged] = useState(true);
  const session = useMemo<Session>(() => {
    if (!logged) return null;
    return {
      user: {
        id: "00000000-0000-0000-0000-000000000001",
        email: "tester@example.com",
        user_metadata: { name: "Mock User", avatar_url: "/logo.svg" },
      },
    };
  }, [logged]);

  const profile = useMemo<Profile | null>(() => {
    if (!session) return null;
    return {
      id: session.user.id,
      email: session.user.email,
      full_name: "Mock User",
      created_at: new Date().toISOString(),
    };
  }, [session]);

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    profile,
    loading: false,
    signInWithGoogle: async () => setLogged(true),
    signOut: async () => setLogged(false),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <MockAuthProvider>");
  return ctx;
}
