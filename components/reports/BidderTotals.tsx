"use client";

import { useMemo, useState } from "react";
import type { BidderReportRow } from "@/lib/services/reportCalculator";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Button } from "@/components/ui/Button";
import { downloadCsv } from "@/lib/services/csvExporter";

type SortKey =
  | "paddle"
  | "name"
  | "items"
  | "subtotal"
  | "buyersPremium"
  | "tax"
  | "total"
  | "status";

export function BidderTotals({
  rows,
  currencySymbol,
  eventSlug,
}: {
  rows: BidderReportRow[];
  currencySymbol: string;
  eventSlug: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("paddle");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "paddle":
          cmp = a.paddleNumber - b.paddleNumber;
          break;
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "items":
          cmp = a.itemsWon - b.itemsWon;
          break;
        case "subtotal":
          cmp = a.subtotal - b.subtotal;
          break;
        case "buyersPremium":
          cmp = a.buyersPremium - b.buyersPremium;
          break;
        case "tax":
          cmp = a.tax - b.tax;
          break;
        case "total":
          cmp = a.total - b.total;
          break;
        case "status":
          cmp = a.paymentStatus.localeCompare(b.paymentStatus);
          break;
        default:
          break;
      }
      return cmp * dir;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  function toggle(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function exportCsv() {
    const headers = [
      "Paddle #",
      "Name",
      "Items won",
      "Hammer",
      "Buyer's premium",
      "Tax",
      "Total",
      "Payment status",
    ];
    const data = sorted.map((r) => [
      r.paddleNumber,
      r.name,
      r.itemsWon,
      r.subtotal,
      r.buyersPremium,
      r.tax,
      r.total,
      r.paymentStatus,
    ]);
    downloadCsv(`clerkbid-bidders-${eventSlug}.csv`, headers, data);
  }

  const th = (key: SortKey, label: string) => (
    <th scope="col" className="px-3 py-2 text-left">
      <button
        type="button"
        onClick={() => toggle(key)}
        className="font-semibold text-navy hover:underline dark:text-slate-200"
      >
        {label}
        {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy dark:text-slate-100">
          Bidder totals
        </h2>
        <Button type="button" variant="secondary" onClick={exportCsv}>
          Export as CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-navy/10 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="border-b border-navy/10 bg-surface dark:border-slate-700 dark:bg-slate-800/80">
            <tr>
              {th("paddle", "Paddle #")}
              {th("name", "Name")}
              {th("items", "Items won")}
              {th("subtotal", "Hammer")}
              {th("buyersPremium", "Buyer's prem.")}
              {th("tax", "Tax")}
              {th("total", "Total")}
              {th("status", "Payment status")}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/10 dark:divide-slate-700">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted">
                  No bidders for this event.
                </td>
              </tr>
            ) : (
              sorted.map((r) => (
                <tr
                  key={r.bidderId}
                  className="hover:bg-surface/50 dark:hover:bg-slate-800/50"
                >
                  <td className="px-3 py-2 font-mono font-medium">
                    {r.paddleNumber}
                  </td>
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.itemsWon}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(r.subtotal, currencySymbol)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(r.buyersPremium, currencySymbol)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(r.tax, currencySymbol)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-semibold">
                    {formatCurrency(r.total, currencySymbol)}
                  </td>
                  <td className="px-3 py-2 text-muted">{r.paymentStatus}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
