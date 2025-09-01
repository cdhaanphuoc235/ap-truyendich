import React from "react";
import { cn } from "./cn";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "danger" | "ghost";
  full?: boolean;
};

export default function Button({ variant = "primary", full, className, ...rest }: Props) {
  const base =
    "inline-flex items-center justify-center rounded-xl font-semibold px-4 py-3 transition active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed";
  const styles = {
    primary: "bg-brand-500 hover:bg-brand-600 text-white shadow",
    danger: "bg-red-600 hover:bg-red-700 text-white shadow",
    ghost: "bg-white/15 hover:bg-white/25 text-white",
  }[variant];

  return (
    <button
      className={cn(base, styles, full && "w-full", className)}
      {...rest}
    />
  );
}
