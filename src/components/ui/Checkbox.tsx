import React from "react";

type Props = React.InputHTMLAttributes<HTMLInputElement> & { label: string };

export default function Checkbox({ label, ...rest }: Props) {
  return (
    <label className="flex items-center gap-3 select-none">
      <input
        type="checkbox"
        className="h-5 w-5 rounded border border-slate-300 accent-brand-500"
        {...rest}
      />
      <span className="text-slate-800">{label}</span>
    </label>
  );
}
