import React from "react";
import { cn } from "./ui/cn";

function fmt(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600).toString().padStart(2, "0");
  const mm = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const ss = Math.floor(s % 60).toString().padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export default function Timer({
  seconds,
  emphasize = true,
  state = "normal",
}: {
  seconds: number;
  emphasize?: boolean;
  state?: "normal" | "warning" | "danger";
}) {
  return (
    <div
      className={cn(
        "font-mono tracking-widest",
        emphasize ? "text-4xl sm:text-5xl font-bold" : "text-2xl",
        state === "danger" ? "text-red-600" : state === "warning" ? "text-amber-600" : "text-slate-900"
      )}
      aria-label="Đồng hồ đếm ngược"
    >
      {fmt(seconds)}
    </div>
  );
}
