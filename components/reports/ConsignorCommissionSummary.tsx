"use client";

import { Button } from "@/components/ui/Button";
import type { AuctionEvent, Consignor } from "@/lib/db";
import { downloadCsv } from "@/lib/services/csvExporter";
import {
  buildConsignorStatementPdf,
  openConsignorStatementPdf,
} from "@/lib/services/consignorStatementPdf";
import {
  buildConsignorReportRows,
  computeConsignorCommissionEventTotals,
  type ConsignorReportRow,
} from "@/lib/services/reportCalculator";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import type { Lot, Sale } from "@/lib/db";

export function ConsignorCommissionSummary({
  event,
  consignors,
  lots,
  sales,
}: {
  event: AuctionEvent;
  consignors: Consignor[];
  lots: Lot[];
  sales: Sale[];
}) {
  const rows = buildConsignorReportRows(event, consignors, lots, sales);
  const totals = computeConsignorCommissionEventTotals(rows);
  const sym = event.currencySymbol ?? "$";

  function exportCsv() {
    const headers = [
      "consignorNumber",
      "name",
      "lotsSold",
      "grossHammer",
      "commission",
      "netToConsignor",
      "effectiveRatePct",
    ];
    const data: (string | number)[][] = rows.map((r) => [
      r.consignorNumber ?? "",
      r.name,
      r.lotsSold,
      r.grossHammer,
      r.commission,
      r.netToConsignor,
      Math.round(r.effectiveRate * 10000) / 100,
    ]);
    data.push([
      "",
      "TOTALS",
      totals.lotsSold,
      totals.grossHammer,
      totals.totalCommission,
      totals.netToConsignors,
      "",
    ]);
    downloadCsv(`clerkbid-consignor-commission.csv`, headers, data);
  }

  function statementPdf(c: Consignor) {
    if (c.id == null) return;
    const doc = buildConsignorStatementPdf(event, c, lots, sales, consignors);
    openConsignorStatementPdf(doc);
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-navy dark:text-slate-100">
          Consignors &amp; commission
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={exportCsv}>
            Export commission CSV
          </Button>
        </div>
      </div>
      <p className="text-sm text-muted">
        Commission is a percent of hammer (default from event settings; consignors
        can override). Unassigned lines use the event default rate.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-navy/10 bg-surface-muted/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Gross hammer (sold lines)
          </p>
          <p className="mt-1 text-xl font-semibold text-ink dark:text-slate-100">
            {formatCurrency(totals.grossHammer, sym)}
          </p>
        </div>
        <div className="rounded-lg border border-navy/10 bg-surface-muted/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Commission earned
          </p>
          <p className="mt-1 text-xl font-semibold text-ink dark:text-slate-100">
            {formatCurrency(totals.totalCommission, sym)}
          </p>
        </div>
        <div className="rounded-lg border border-navy/10 bg-surface-muted/50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Net to consignors
          </p>
          <p className="mt-1 text-xl font-semibold text-ink dark:text-slate-100">
            {formatCurrency(totals.netToConsignors, sym)}
          </p>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-navy/10 dark:border-slate-700">
        <table className="min-w-full text-sm">
          <thead className="border-b border-navy/10 bg-surface-muted/80 dark:border-slate-700 dark:bg-slate-800/80">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-ink dark:text-slate-100">
                #
              </th>
              <th className="px-3 py-2 text-left font-medium text-ink dark:text-slate-100">
                Name
              </th>
              <th className="px-3 py-2 text-right font-medium text-ink dark:text-slate-100">
                Lots
              </th>
              <th className="px-3 py-2 text-right font-medium text-ink dark:text-slate-100">
                Hammer
              </th>
              <th className="px-3 py-2 text-right font-medium text-ink dark:text-slate-100">
                Commission
              </th>
              <th className="px-3 py-2 text-right font-medium text-ink dark:text-slate-100">
                Net
              </th>
              <th className="px-3 py-2 text-right font-medium text-ink dark:text-slate-100">
                PDF
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <ConsignorReportTableRow
                key={r.key}
                row={r}
                sym={sym}
                consignors={consignors}
                onStatement={statementPdf}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConsignorReportTableRow({
  row,
  sym,
  consignors,
  onStatement,
}: {
  row: ConsignorReportRow;
  sym: string;
  consignors: Consignor[];
  onStatement: (c: Consignor) => void;
}) {
  const c =
    row.consignorNumber != null
      ? consignors.find((x) => x.consignorNumber === row.consignorNumber)
      : undefined;
  const canPdf = c?.id != null && row.key !== "unassigned";

  return (
    <tr className="border-b border-navy/5 last:border-0 dark:border-slate-800">
      <td className="px-3 py-2 font-mono text-muted">
        {row.consignorNumber ?? "—"}
      </td>
      <td className="px-3 py-2 text-ink dark:text-slate-100">{row.name}</td>
      <td className="px-3 py-2 text-right tabular-nums text-muted">
        {row.lotsSold}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatCurrency(row.grossHammer, sym)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {formatCurrency(row.commission, sym)}
      </td>
      <td className="px-3 py-2 text-right tabular-nums font-medium">
        {formatCurrency(row.netToConsignor, sym)}
      </td>
      <td className="px-3 py-2 text-right">
        {canPdf && c ? (
          <Button
            type="button"
            variant="secondary"
            className="py-1 text-xs"
            onClick={() => onStatement(c)}
          >
            Statement
          </Button>
        ) : (
          <span className="text-muted">—</span>
        )}
      </td>
    </tr>
  );
}
