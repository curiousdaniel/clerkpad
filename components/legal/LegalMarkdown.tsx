"use client";

import ReactMarkdown from "react-markdown";

const h1 =
  "text-3xl font-bold tracking-tight text-navy first:mt-0 mt-10 mb-4 dark:text-slate-100";
const h2 =
  "text-xl font-semibold text-navy mt-8 mb-3 border-b border-navy/10 pb-2 dark:border-slate-700 dark:text-slate-100";
const p = "text-sm leading-relaxed text-ink mb-4";
const ul = "mb-4 list-disc space-y-2 pl-5 text-sm text-ink";
const ol = "mb-4 list-decimal space-y-2 pl-5 text-sm text-ink";
const li = "leading-relaxed";

export function LegalMarkdown({ content }: { content: string }) {
  return (
    <article>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className={h1}>{children}</h1>,
          h2: ({ children }) => <h2 className={h2}>{children}</h2>,
          p: ({ children }) => <p className={p}>{children}</p>,
          ul: ({ children }) => <ul className={ul}>{children}</ul>,
          ol: ({ children }) => <ol className={ol}>{children}</ol>,
          li: ({ children }) => <li className={li}>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-ink">{children}</strong>
          ),
          a: ({ href, children }) => {
            const external = href?.startsWith("http");
            return (
              <a
                href={href}
                className="font-medium text-navy underline decoration-navy/30 underline-offset-2 hover:decoration-navy dark:text-sky-300 dark:decoration-sky-400/50 dark:hover:decoration-sky-300"
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  );
}
