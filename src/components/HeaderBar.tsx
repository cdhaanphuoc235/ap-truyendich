import React from "react";
import { useAuth } from "../auth/AuthProvider";

export default function HeaderBar() {
  const { user, profile, signOut } = useAuth();

  const displayName =
    profile?.full_name ||
    (user?.user_metadata?.name as string | undefined) ||
    (user?.email ?? "Người dùng");

  const avatar =
    (user?.user_metadata?.avatar_url as string | undefined) || "/logo.svg";

  return (
    <header className="sticky top-0 z-10 bg-brand-600 text-white p-4 shadow">
      <div className="max-w-screen-sm mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="logo" className="w-6 h-6" />
          <h1 className="text-xl font-semibold">Truyen dich</h1>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img src={avatar} alt="avatar" className="w-7 h-7 rounded-full bg-white" />
            <span className="text-sm">{displayName}</span>
          </div>
          <button
            onClick={signOut}
            className="bg-white/15 hover:bg-white/25 text-white rounded-lg px-3 py-1 text-sm"
            title="Đăng xuất"
          >
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  );
}
