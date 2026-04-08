"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/utils/formatDate";

type Row = {
  id: string;
  title?: string;
  body: string;
  severity: "info" | "warning";
  issuedAt: string;
  deliveryAudience: string;
};

export default function AnnouncementsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/announcements/", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json()) as {
          announcements?: Row[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load messages.");
          setRows([]);
          return;
        }
        setRows(data.announcements ?? []);
        setError(null);
      } catch {
        if (!cancelled) setError("Could not load messages.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      <Header
        title="Message center"
        description="Product updates and notices from ClerkBid. Only messages the team chose to keep in this log appear here."
      />

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading…</p>
      ) : error ? (
        <Card className="mt-6 border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100">
          {error}
        </Card>
      ) : rows.length === 0 ? (
        <Card className="mt-6 p-6 text-sm text-muted">
          No messages in the log yet.
        </Card>
      ) : (
        <ul className="mt-6 space-y-4">
          {rows.map((r) => (
            <li key={r.id}>
              <Card
                className={`p-4 ${
                  r.severity === "warning"
                    ? "border-amber-400/40 bg-amber-50/80 dark:border-amber-800 dark:bg-amber-950/30"
                    : ""
                }`}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-sm font-semibold text-ink dark:text-slate-100">
                    {r.title ?? "Notice"}
                  </h2>
                  <time
                    className="text-xs text-muted"
                    dateTime={r.issuedAt}
                  >
                    {formatDateTime(r.issuedAt)}
                  </time>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-ink dark:text-slate-200">
                  {r.body}
                </p>
                <p className="mt-2 text-xs text-muted">
                  {r.deliveryAudience === "persist_cross_session"
                    ? "Saved for users when they sign in"
                    : "Also sent to online users"}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
