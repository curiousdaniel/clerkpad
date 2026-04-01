"use client";

import { useMemo, useState } from "react";
import type { LotReportRow } from "@/lib/services/reportCalculator";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Button } from "@/components/ui/Button";
import { downloadCsv } from "@/lib/services/csvExporter";

type SortKey =
  | "lot"
  | "description"
  | "consignor"
  | "qty"
  | "status"
  | "bid"
  | "paddle"
  | "clerk";

export function LotResults({
  rows,
  currencySymbol,
  eventSlug,
}: {
  rows: LotReportRow[];
  currencySymbol: string;
  eventSlug: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("lot");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const sorted = useMemo(() => {
    const dir = sortDir === "asc" ? 1 : -1;
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "lot":
          cmp =
            a.baseLotNumber !== b.baseLotNumber
              ? a.baseLotNumber - b.baseLotNumber
              : a.displayLotNumber.localeCompare(b.displayLotNumber, undefined, {
                  numeric: true,
                });
          break;
        case "description":
          cmp = a.description.localeCompare(b.description);
          break;
        case "consignor":
          cmp = a.consignor.localeCompare(b.consignor);
          break;
        case "qty":
          cmp = a.quantity - b.quantity;
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "bid":
          cmp = (a.winningBid ?? -1) - (b.winningBid ?? -1);
          break;
        case "paddle":
          cmp = (a.winningPaddle ?? -1) - (b.winningPaddle ?? -1);
          break;
        case "clerk":
          cmp = a.clerk.localeCompare(b.clerk);
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
      "Lot #",
      "Description",
      "Consignor",
      "Qty",
      "Status",
      "Winning bid",
      "Winning paddle",
      "Clerk",
    ];
    const data = sorted.map((r) => [
      r.displayLotNumber,
      r.description,
      r.consignor,
      r.quantity,
      r.status,
      r.winningBid ?? "",
      r.winningPaddle ?? "",
      r.clerk,
    ]);
    downloadCsv(`clerkbid-lots-${eventSlug}.csv`, headers, data);
  }

  const th = (key: SortKey, label: string, align: "left" | "right" = "left") => (
    <th
      scope="col"
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => toggle(key)}
        className="font-semibold text-navy hover:underline"
      >
        {label}
        {sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
      </button>
    </th>
  );

  const hasSuffix = (r: LotReportRow) => r.lotSuffix.length > 0;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy">Lot results</h2>
        <Button type="button" variant="secondary" onClick={exportCsv}>
          Export as CSV
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-navy/10 bg-white">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="border-b border-navy/10 bg-surface">
            <tr>
              {th("lot", "Lot #")}
              {th("description", "Description")}
              {th("consignor", "Consignor")}
              {th("qty", "Qty", "right")}
              {th("status", "Status")}
              {th("bid", "Winning bid", "right")}
              {th("paddle", "Paddle", "right")}
              {th("clerk", "Clerk")}
            </tr>
          </thead>
          <tbody className="divide-y divide-navy/10">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted">
                  No lots for this event.
                </td>
              </tr>
            ) : (
              sorted.map((r, idx) => {
                const prev = sorted[idx - 1];
                const groupBreak =
                  idx > 0 && prev && prev.baseLotNumber !== r.baseLotNumber;
                const passOut = hasSuffix(r);
                return (
                  <tr
                    key={`${r.lotId}-${r.displayLotNumber}`}
                    className={`hover:bg-surface/50 ${groupBreak ? "border-t-2 border-t-gold/40" : ""} ${passOut ? "bg-amber-50/40" : ""}`}
                  >
                    <td
                      className={`px-3 py-2 font-mono font-medium text-navy ${passOut ? "pl-8" : ""}`}
                    >
                      {r.displayLotNumber}
                    </td>
                    <td className="px-3 py-2">{r.description}</td>
                    <td className="px-3 py-2 text-muted">{r.consignor || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.quantity}
                    </td>
                    <td className="px-3 py-2 capitalize text-muted">
                      {r.status}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.winningBid != null
                        ? formatCurrency(r.winningBid, currencySymbol)
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {r.winningPaddle != null ? r.winningPaddle : "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-muted">
                      {r.clerk || "—"}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
