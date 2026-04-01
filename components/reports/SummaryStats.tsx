"use client";

import type { EventSummaryStats } from "@/lib/services/reportCalculator";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Card } from "@/components/ui/Card";

export function SummaryStats({
  stats,
  currencySymbol,
}: {
  stats: EventSummaryStats;
  currencySymbol: string;
}) {
  const sym = currencySymbol;
  const c = [
    {
      label: "Total revenue",
      value: formatCurrency(stats.totalRevenue, sym),
      accent: "text-gold",
    },
    {
      label: "Lots sold / passed / unsold / withdrawn",
      value: `${stats.lotsSold} / ${stats.lotsPassed} / ${stats.lotsUnsold} / ${stats.lotsWithdrawn}`,
      accent: "text-navy",
    },
    {
      label: "Registered bidders",
      value: String(stats.bidderCount),
      accent: "text-navy",
    },
    {
      label: "Active bidders (purchased)",
      value: String(stats.activeBidderCount),
      accent: "text-navy",
    },
    {
      label: "Average sale",
      value: formatCurrency(stats.avgSaleAmount, sym),
      accent: "text-navy",
    },
    {
      label: "Highest sale",
      value: stats.highestSale
        ? `${stats.highestSale.displayLotNumber} · ${formatCurrency(stats.highestSale.amount, sym)}`
        : "—",
      accent: "text-navy",
    },
    {
      label: "Tax collected (paid invoices)",
      value: formatCurrency(stats.totalTaxCollected, sym),
      accent: "text-navy",
    },
    {
      label: "Total invoiced",
      value: formatCurrency(stats.totalInvoiced, sym),
      accent: "text-navy",
    },
    {
      label: "Total paid",
      value: formatCurrency(stats.totalPaid, sym),
      accent: "text-success",
    },
    {
      label: "Outstanding (unpaid)",
      value: formatCurrency(stats.totalOutstanding, sym),
      accent: "text-warning",
    },
  ];

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-navy">Event summary</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {c.map((item) => (
          <Card key={item.label} className="!p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              {item.label}
            </p>
            <p className={`mt-1 text-sm font-semibold leading-snug ${item.accent}`}>
              {item.value}
            </p>
          </Card>
        ))}
      </div>
    </section>
  );
}
