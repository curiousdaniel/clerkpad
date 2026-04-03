"use client";

import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { HelpMarkdown } from "@/components/help/HelpMarkdown";
import { helpTableOfContents } from "@/lib/help/toc";
import { helpFaqs } from "@/lib/help/faq";

function TocLinks() {
  return (
    <ul className="space-y-2 text-sm">
      {helpTableOfContents.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className="text-navy/80 hover:text-navy hover:underline dark:text-slate-300 dark:hover:text-slate-100"
          >
            {item.label}
          </a>
        </li>
      ))}
      <li>
        <a
          href="#frequently-asked-questions"
          className="text-navy/80 hover:text-navy hover:underline dark:text-slate-300 dark:hover:text-slate-100"
        >
          Frequently asked questions
        </a>
      </li>
    </ul>
  );
}

export function HelpPageShell({ markdown }: { markdown: string }) {
  return (
    <>
      <a
        href="#help-main"
        className="fixed left-4 top-4 z-[200] -translate-y-[200%] rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white shadow-md transition focus:translate-y-0 focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2 dark:bg-slate-100 dark:text-navy dark:focus:ring-offset-slate-950"
      >
        Skip to guide content
      </a>

      <Header
        title="Help and FAQ"
        description="How to use ClerkBid for your auction event—from setup to invoices and reports."
      />

      <div
        className="mb-8 rounded-xl border border-gold/35 bg-gradient-to-br from-amber-50/90 to-surface-muted/60 p-4 shadow-sm dark:border-amber-800/40 dark:from-amber-950/35 dark:to-slate-900/50"
        role="region"
        aria-label="Send feedback"
      >
        <p className="text-sm font-semibold text-navy dark:text-slate-100">
          Want a change or have a problem?
        </p>
        <p className="mt-1 text-sm text-muted dark:text-slate-300">
          We read every message and use it to fix bugs, clarify the product, and
          prioritize new features.
        </p>
        <Link
          href="/feedback/"
          className="mt-3 inline-flex items-center rounded-lg bg-navy px-3 py-2 text-sm font-medium text-white transition hover:bg-navy/90 focus:outline-none focus:ring-2 focus:ring-navy focus:ring-offset-2 dark:bg-slate-100 dark:text-navy dark:hover:bg-white dark:focus:ring-slate-100 dark:focus:ring-offset-slate-950"
        >
          Send feedback &amp; requests
        </Link>
      </div>

      <div className="lg:grid lg:grid-cols-[minmax(0,220px)_minmax(0,1fr)] lg:gap-10 xl:grid-cols-[minmax(0,240px)_minmax(0,1fr)]">
        <div className="mb-6 lg:mb-0">
          <details className="rounded-lg border border-navy/10 bg-surface-muted/50 dark:border-slate-700 lg:hidden">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-navy dark:text-slate-100 [&::-webkit-details-marker]:hidden">
              <span className="after:ml-1 after:text-muted after:content-['▾']">
                On this page
              </span>
            </summary>
            <nav
              className="border-t border-navy/10 px-4 py-3 dark:border-slate-700"
              aria-label="On this page"
            >
              <TocLinks />
            </nav>
          </details>
          <nav
            className="sticky top-6 hidden lg:block"
            aria-label="On this page"
          >
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
              On this page
            </p>
            <TocLinks />
          </nav>
        </div>

        <div
          id="help-main"
          tabIndex={-1}
          className="min-w-0 outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
        >
          <HelpMarkdown content={markdown} />

          <section
            id="frequently-asked-questions"
            className="scroll-mt-24 border-t border-navy/10 pt-10 dark:border-slate-700"
            aria-labelledby="faq-heading"
          >
            <h2
              id="faq-heading"
              className="text-xl font-semibold text-navy dark:text-slate-100"
            >
              Frequently asked questions
            </h2>
            <div className="mt-4 space-y-2">
              {helpFaqs.map((item) => (
                <details
                  key={item.question}
                  className="group rounded-lg border border-navy/10 bg-surface dark:border-slate-700 dark:bg-slate-900/40"
                >
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink dark:text-slate-100 [&::-webkit-details-marker]:hidden">
                    <span className="flex items-start justify-between gap-2">
                      {item.question}
                      <span
                        className="shrink-0 text-muted transition group-open:rotate-180"
                        aria-hidden
                      >
                        ▾
                      </span>
                    </span>
                  </summary>
                  <div className="border-t border-navy/10 px-4 py-3 text-sm leading-relaxed text-muted dark:border-slate-700 dark:text-slate-300">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          </section>

          <p className="mt-10 text-sm text-muted">
            Legal: see the{" "}
            <Link
              href="/user-agreement/"
              className="font-medium text-navy underline underline-offset-2 dark:text-sky-300"
            >
              User agreement
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy-policy/"
              className="font-medium text-navy underline underline-offset-2 dark:text-sky-300"
            >
              Privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  );
}
