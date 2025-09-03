// src/auth/index.ts
import React from "react";
import MockAuthProvider, { useAuth as useAuthMock } from "./MockAuthProvider";
import { AuthProvider as SupabaseAuthProvider, useAuth as useAuthSupabase } from "./AuthProvider";

const mode = (import.meta.env.VITE_AUTH_MODE || "supabase").toLowerCase();

/**
 * Wrapper provider: render đúng provider theo ENV.
 * Top-level export hợp lệ cho bundler (không export trong if/else).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return mode === "mock" ? (
    <MockAuthProvider>{children}</MockAuthProvider>
  ) : (
    <SupabaseAuthProvider>{children}</SupabaseAuthProvider>
  );
}

/**
 * Wrapper hook: ủy quyền tới hook tương ứng theo ENV.
 * Lưu ý: Provider bên trên PHẢI khớp với hook này (đã đảm bảo).
 */
export function useAuth() {
  return mode === "mock" ? useAuthMock() : useAuthSupabase();
}
