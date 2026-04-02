import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral:
      "bg-surface text-ink border-navy/10 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
    success:
      "bg-green-50 text-success border-success/20 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
    warning:
      "bg-amber-50 text-warning border-warning/30 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
    danger:
      "bg-red-50 text-danger border-danger/20 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
