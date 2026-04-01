import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  const tones = {
    neutral: "bg-surface text-ink border-navy/10",
    success: "bg-green-50 text-success border-success/20",
    warning: "bg-amber-50 text-warning border-warning/30",
    danger: "bg-red-50 text-danger border-danger/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
