import React, { useEffect, useRef, useState } from "react";
import { useAuth } from "./auth";
import Login from "./pages/Login";
import HeaderBar from "./components/HeaderBar";
import SectionCard from "./components/SectionCard";
import InfusionForm from "./components/InfusionForm";
import ActiveInfusionList from "./components/ActiveInfusionList";
import HistoryList from "./components/HistoryList";
import { clearHistory, listActive, listHistory, subscribeInfusions, cancelInfusion } from "./lib/db";
import type { Infusion } from "./types";
import { useOnline } from "./hooks/useOnline";
import { loadLists, saveLists } from "./lib/offlineStore";
import OfflineBanner from "./components/OfflineBanner";

export default function App() {
  const { session, loading, user } = useAuth();
  const online = useOnline();

  const [active, setActive] = useState<Infusion[]>([]);
  const [history, setHistory] = useState<Infusion[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const refreshing = useRef(false);
  const throttleId = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    let unsub: (() => void) | undefined;

    (async () => {
      await refreshLists();
      // throttle realtime: gộp nhiều sự kiện trong 500ms
      const scheduleRefresh = () => {
        if (throttleId.current) return;
        throttleId.current = window.setTimeout(async () => {
          throttleId.current = null;
          await refreshLists();
        }, 500);
      };
      unsub = subscribeInfusions(user.id, scheduleRefresh);
    })();

    return () => {
      if (unsub) unsub();
      if (throttleId.current) {
        clearTimeout(throttleId.current);
        throttleId.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, online]);

  async function refreshLists() {
    try {
      if (refreshing.current) return;
      refreshing.current = true;
      setLoadingData(true);

      if (!online) {
        const cached = loadLists();
        if (cached) {
          setActive(cached.active);
          setHistory(cached.history);
          setSavedAt(cached.savedAt ?? null);
        } else {
          setActive([]);
          setHistory([]);
          setSavedAt(null);
        }
        return;
      }

      const [a, h] = await Promise.all([listActive(), listHistory()]);
      setActive(a);
      setHistory(h);
      saveLists(a, h);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      const cached = loadLists();
      if (cached) {
        setActive(cached.active);
        setHistory(cached.history);
        setSavedAt(cached.savedAt ?? null);
      }
      console.warn(e);
    } finally {
      setLoadingData(false);
      refreshing.current = false;
    }
  }

  async function onCancel(id: string) {
    if (!confirm("Hủy ca truyền này? (Sẽ chuyển xuống Lịch sử, không gửi thông báo)")) return;
    try {
      await cancelInfusion(id);
      await refreshLists();
    } catch (e: any) {
      alert(`Không thể hủy ca: ${e.message || e}`);
    }
  }

  async function onClearHistory() {
    if (!history.length) return;
    if (!confirm("Xóa TẤT CẢ lịch sử (của bạn)?")) return;
    try {
      await clearHistory();
      await refreshLists();
    } catch (e: any) {
      alert(`Không thể xóa lịch sử: ${e.message || e}`);
    }
  }

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

  return (
    <div className="min-h-screen flex flex-col">
      <HeaderBar />

      <main className="flex-1 max-w-screen-sm mx-auto p-4 space-y-6">
        {!online && <OfflineBanner savedAt={savedAt} />}

        <SectionCard title="Vùng 2 — Form Nhập liệu">
          <InfusionForm />
        </SectionCard>

        <SectionCard
          title="Vùng 3 — Danh sách ca đang truyền"
          trailing={<span className="text-xs text-slate-500">{loadingData ? "Đang tải…" : `${active.length} ca`}</span>}
        >
          <ActiveInfusionList items={active} onCancel={onCancel} />
        </SectionCard>

        <SectionCard
          title="Vùng 4 — Lịch sử"
          trailing={<span className="text-xs text-slate-500">{loadingData ? "…" : `${history.length} mục`}</span>}
        >
          <HistoryList items={history} onClear={onClearHistory} />
        </SectionCard>
      </main>

      <footer className="max-w-screen-sm mx-auto p-6 text-center text-slate-500">
        Sử dụng cho Điều dưỡng An Phước
      </footer>
    </div>
  );
}
