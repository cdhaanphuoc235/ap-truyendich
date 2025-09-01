import React from "react";
import { cn } from "./cn";

type Props = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
  hint?: string;
};

export default function Select({ label, hint, className, children, ...rest }: Props) {
  return (
    <label className="block">
      {label && <div className="mb-1 text-sm font-medium text-slate-800">{label}</div>}
      <select
        className={cn(
          "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none focus:ring-2 focus:ring-brand-500",
          className
        )}
        {...rest}
      >
        {children}
      </select>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </label>
  );
}
