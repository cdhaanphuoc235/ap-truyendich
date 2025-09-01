import React from "react";
import type { Infusion } from "../types";
import Button from "./ui/Button";
import { History } from "lucide-react";
import { fmtHm } from "../lib/time";

export default function HistoryList({
  items,
  onClear,
}: {
  items: Infusion[];
  onClear: () => void;
}) {
  return (
    <div>
      <div className="flex justify-end mb-3">
        <Button
          variant="danger"
          onClick={onClear}
          className="flex items-center gap-2"
          disabled={!items.length}
          title="Xóa tất cả lịch sử của bạn"
        >
          <History className="w-4 h-4" />
          Xóa tất cả lịch sử
        </Button>
      </div>

      {!items.length ? (
        <div className="text-sm text-slate-600">
          Chưa có lịch sử. (Sẽ xuất hiện khi ca hoàn thành/hủy)
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-xl border border-slate-200 p-3 flex items-center justify-between"
            >
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {it.patient_name} • {it.room ?? "—"} • {it.bed ?? "—"}
                </div>
                <div className="text-xs text-slate-500">
                  Trạng thái:{" "}
                  <span className={it.status === "canceled" ? "text-red-600" : "text-green-700"}>
                    {it.status}
                  </span>{" "}
                  • Kết thúc dự kiến: {fmtHm(it.end_at)}
                </div>
              </div>
              <div className="text-[11px] text-slate-500 ml-2 whitespace-nowrap">
                {new Date(it.created_at).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
