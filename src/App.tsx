import React from "react";

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-brand-600 text-white p-4 shadow">
        <div className="max-w-screen-sm mx-auto flex items-center justify-between">
          <h1 className="text-xl font-semibold">Truyen dich</h1>
          <span className="text-sm opacity-90">Giai đoạn 1 • Scaffold</span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 max-w-screen-sm mx-auto p-4 space-y-6">
        <section className="card">
          <h2 className="section-title">Vùng 2 — Form Nhập liệu</h2>
          <p className="text-sm text-slate-600">
            Sẽ được hiện thực ở Giai đoạn 4–5 (kèm tính giờ & xác thực).
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

      {/* Footer */}
      <footer className="max-w-screen-sm mx-auto p-6 text-center text-slate-500">
        Sử dụng cho Điều dưỡng An Phước
      </footer>
    </div>
  );
}
