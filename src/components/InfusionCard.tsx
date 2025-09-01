import React from "react";
import type { Infusion } from "../types";
import Timer from "./Timer";
import Button from "./ui/Button";
import { XCircle } from "lucide-react";
import { fmtHm } from "../lib/time";
import { useCountdown } from "../hooks/useCountdown";

export default function InfusionCard({
  item,
  onCancel,
}: {
  item: Infusion;
  onCancel: (id: string) => void;
}) {
  const secs = useCountdown(item.end_at);

  const state = secs === 0 ? "danger" : secs <= 60 ? "warning" : "normal";

  return (
    <div className="rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="font-medium truncate">
          {item.patient_name} • {item.room ?? "—"} • {item.bed ?? "—"}
        </div>
        <div className="text-xs text-slate-500">
          Kết thúc dự kiến: <strong>{fmtHm(item.end_at)}</strong>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Timer seconds={secs} state={state as any} />
        <Button
          variant="danger"
          onClick={() => onCancel(item.id)}
          className="flex items-center gap-2"
          aria-label="Hủy ca truyền"
          title="Hủy ca truyền (không gửi thông báo/email)"
        >
          <XCircle className="w-4 h-4" />
          Hủy
        </Button>
      </div>
    </div>
  );
}
