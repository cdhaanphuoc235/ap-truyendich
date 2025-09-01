import React from "react";
import { useAuth } from "./auth/AuthProvider";
import Login from "./pages/Login";
import HeaderBar from "./components/HeaderBar";

export default function App() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50">
        <div className="text-slate-600">Đang tải…</div>
      </div>
    );
  }

  if (!session) {
    // Chưa đăng nhập => tới màn hình Login (nền xanh, nút Google)
    return <Login />;
  }

  // Đã đăng nhập => hiển thị khung chính (placeholder giai đoạn 1)
  return (
    <div className="min-h-screen flex flex-col">
      <HeaderBar />

      <main className="flex-1 max-w-screen-sm mx-auto p-4 space-y-6">
        <section className="card">
          <h2 className="section-title">Vùng 2 — Form Nhập liệu</h2>
          <p className="text-sm text-slate-600">
            (Sẽ hiện thực ở Giai đoạn 4–5: tính giờ & xác thực, Supabase.)
          </p>
          <button className="btn-primary mt-3">Bắt đầu truyền (placeholder)</button>
        </section>

        <section className="card">
          <h2 className="section-title">Vùng 3 — Danh sách ca đang truyền</h2>
          <div className="text-sm text-slate-600">Chưa có dữ liệu (placeholder)</div>
        </section>

        <section className="card">
          <h2 className="section-title">Vùng 4 — Lịch sử</h2>
          <div className="text-sm text-slate-600">Chưa có dữ liệu (placeholder)</div>
        </section>
      </main>

      <footer className="max-w-screen-sm mx-auto p-6 text-center text-slate-500">
        Sử dụng cho Điều dưỡng An Phước
      </footer>
    </div>
  );
}
