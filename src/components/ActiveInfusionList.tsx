import React from "react";
import type { Infusion } from "../types";
import InfusionCard from "./InfusionCard";

export default function ActiveInfusionList({
  items,
  onCancel,
}: {
  items: Infusion[];
  onCancel: (id: string) => void;
}) {
  if (!items.length) {
    return <div className="text-sm text-slate-600">Chưa có ca nào đang truyền.</div>;
  }
  return (
    <div className="space-y-3">
      {items.map((it) => (
        <InfusionCard key={it.id} item={it} onCancel={onCancel} />
      ))}
    </div>
  );
}
