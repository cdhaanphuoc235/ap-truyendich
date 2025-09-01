import React from "react";
import { useAuth } from "../auth/AuthProvider";

export default function Login() {
  const { signInWithGoogle } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-500">
      <div className="w-full max-w-sm p-6">
        <div className="bg-white rounded-2xl shadow p-6 text-center">
          <img src="/logo.svg" alt="logo" className="mx-auto w-16 h-16 mb-3" />
          <h1 className="text-xl font-semibold text-slate-900">Truyen dich</h1>
          <p className="text-slate-600 text-sm mt-1">
            PWA hỗ trợ điều dưỡng tính & theo dõi thời gian truyền dịch.
          </p>

          <button
            onClick={signInWithGoogle}
            className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-5 h-5"
            >
              <path
                fill="#FFC107"
                d="M43.6 20.5H42v-.1H24v7.2h11.3C33.8 31.9 29.3 35 24 35c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.3 0 6.3 1.2 8.6 3.2l5.1-5.1C33.8 3.1 29.2 1 24 1 11.8 1 2 10.8 2 23s9.8 22 22 22 22-9.8 22-22c0-1.4-.1-2.5-.4-3.5z"
              />
              <path
                fill="#FF3D00"
                d="M6.3 14.7l5.9 4.3C14 15.7 18.6 13 24 13c3.3 0 6.3 1.2 8.6 3.2l5.1-5.1C33.8 7.1 29.2 5 24 5 16.1 5 9.3 9.6 6.3 14.7z"
              />
              <path
                fill="#4CAF50"
                d="M24 41c5.2 0 9.8-1.9 13.3-5.1l-6.2-5.2C29.8 32.1 27.1 33 24 33c-5.2 0-9.6-3.4-11.2-8.1l-6.5 5C8.9 36.5 15.9 41 24 41z"
              />
              <path
                fill="#1976D2"
                d="M43.6 20.5H42v-.1H24v7.2h11.3c-1.1 3.2-3.4 5.8-6.2 7.5l6.2 5.2c-.4.3 7.7-4.5 7.7-13.3 0-1.4-.1-2.5-.4-3.5z"
              />
            </svg>
            Đăng nhập bằng Google
          </button>

          <p className="text-xs text-slate-500 mt-3">
            Chỉ sử dụng trong nội bộ Điều dưỡng An Phước.
          </p>
        </div>
      </div>
    </div>
  );
}
