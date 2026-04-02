"use client";

import {
  AUCTION_METHOD_BRAND,
  AUCTION_METHOD_URL,
} from "@/lib/utils/attribution";

export function PoweredByFooter() {
  return (
    <footer className="shrink-0 border-t border-navy/10 bg-surface/90 px-4 py-2 text-center text-[11px] text-muted backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-400">
      Powered by{" "}
      <a
        href={AUCTION_METHOD_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-navy underline decoration-navy/40 underline-offset-2 transition hover:text-gold hover:decoration-gold dark:text-slate-300 dark:decoration-slate-500"
      >
        {AUCTION_METHOD_BRAND}
      </a>
    </footer>
  );
}
