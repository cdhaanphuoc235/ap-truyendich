// src/auth/index.tsx
import React from "react";
import MockAuthProvider, { useAuth as useAuthMock } from "./MockAuthProvider";
import {
  AuthProvider as SupabaseAuthProvider,
  useAuth as useAuthSupabase,
} from "./AuthProvider";

const mode = (import.meta.env.VITE_AUTH_MODE || "supabase").toLowerCase();

/**
 * Wrapper provider: chọn provider theo ENV ở runtime.
 * (Top-level export hợp lệ cho bundler)
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return mode === "mock" ? (
    <MockAuthProvider>{children}</MockAuthProvider>
  ) : (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  );
}

/** Hook ủy quyền theo ENV */
export function useAuth() {
  return mode === "mock" ? useAuthMock() : useAuthSupabase();
}
