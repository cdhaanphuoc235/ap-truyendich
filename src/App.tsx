import React from "react";
import { useAuth } from "./auth/AuthProvider";
import Login from "./pages/Login";
import HeaderBar from "./components/HeaderBar";
import SectionCard from "./components/SectionCard";
import InfusionForm from "./components/InfusionForm";
import Button from "./components/ui/Button";
import Timer from "./components/Timer";
import { History, XCircle } from "lucide-react";

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
    return <Login />;
  }

  // GĐ4: UI-only (chưa nối DB). Danh sách là placeholder.
  const hasActive = false;
  const hasHistory = false;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Vùng 1: Header */}
      <HeaderBar />

      <main className="flex-1 max-w-screen-sm mx-auto p-4 space-y-6">
        {/* Vùng 2: Form Nhập liệu */}
        <SectionCard title="Vùng 2 — Form Nhập liệu">
          <InfusionForm />
        </SectionCard>

        {/* Vùng 3: Danh sách ca đang truyền */}
        <SectionCard
          title="Vùng 3 — Danh sách ca đang truyền"
          trailing={
            <span className="text-xs text-slate-500">
              (Realtime & countdown sẽ nối ở GĐ5)
            </span>
          }
        >
          {!hasActive ? (
            <div className="text-sm text-slate-600">Chưa có ca nào đang truyền.</div>
          ) : (
            <div className="space-y-3">
              {/* Ví dụ card mẫu nếu cần demo UI:
              <div className="rounded-2xl border p-4 flex items-center justify-between">
                <div>
                  <div className="font-medium">Nguyễn Thị A • P301 • G12</div>
                  <div className="text-xs text-slate-500">Kết thúc dự kiến: 10:45</div>
                </div>
                <div className="flex items-center gap-4">
                  <Timer seconds={1800} />
                  <Button variant="danger" className="flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Hủy
                  </Button>
                </div>
              </div>
              */}
            </div>
          )}
        </SectionCard>

        {/* Vùng 4: Lịch sử */}
        <SectionCard
          title="Vùng 4 — Lịch sử"
          trailing={
            <Button variant="danger" className="flex items-center gap-2" disabled>
              <History className="w-4 h-4" />
              Xóa tất cả lịch sử
            </Button>
          }
        >
          {!hasHistory ? (
            <div className="text-sm text-slate-600">
              Chưa có lịch sử. (Sẽ xuất hiện khi ca hoàn thành/hủy — GĐ5/6)
            </div>
          ) : (
            <div className="space-y-2">
              {/* items */}
            </div>
          )}
        </SectionCard>
      </main>

      {/* Footer */}
      <footer className="max-w-screen-sm mx-auto p-6 text-center text-slate-500">
        Sử dụng cho Điều dưỡng An Phước
      </footer>
    </div>
  );
}
