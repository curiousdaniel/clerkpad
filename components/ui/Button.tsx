import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary:
    "bg-navy text-white hover:bg-navy-dark focus-visible:ring-navy disabled:opacity-50",
  secondary:
    "bg-surface text-ink border border-navy/15 hover:border-navy/30 focus-visible:ring-navy dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500",
  ghost:
    "text-navy hover:bg-surface focus-visible:ring-navy dark:text-slate-200 dark:hover:bg-slate-800",
  danger:
    "bg-danger text-white hover:bg-red-700 focus-visible:ring-danger disabled:opacity-50",
};

export function Button({
  variant = "primary",
  className = "",
  type,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  children: ReactNode;
}) {
  return (
    <button
      type={type ?? "button"}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
