import Link from "next/link";
import type { ReactNode } from "react";

export function LegalDocShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-navy/10 bg-white">
        <nav
          className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4 text-sm"
          aria-label="Legal"
        >
          <Link href="/" className="font-semibold text-navy hover:underline">
            ClerkBid
          </Link>
          <span className="text-navy/25" aria-hidden>
            ·
          </span>
          <Link
            href="/user-agreement/"
            className="text-muted hover:text-navy hover:underline"
          >
            User agreement
          </Link>
          <Link
            href="/privacy-policy/"
            className="text-muted hover:text-navy hover:underline"
          >
            Privacy policy
          </Link>
        </nav>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10 pb-20">{children}</main>
    </div>
  );
}
