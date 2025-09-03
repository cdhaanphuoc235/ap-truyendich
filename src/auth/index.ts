const mode = (import.meta.env.VITE_AUTH_MODE || "supabase").toLowerCase();

if (mode === "mock") {
  // @ts-ignore
  export { default as AuthProvider, useAuth } from "./MockAuthProvider";
} else {
  // @ts-ignore
  export { AuthProvider, useAuth } from "./AuthProvider";
}
