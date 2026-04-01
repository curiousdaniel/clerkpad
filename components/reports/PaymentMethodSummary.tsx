"use client";

import type { PaymentMethodBreakdownRow } from "@/lib/services/reportCalculator";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { Card } from "@/components/ui/Card";

export function PaymentMethodSummary({
  rows,
  currencySymbol,
}: {
  rows: PaymentMethodBreakdownRow[];
  currencySymbol: string;
}) {
  const max = rows.reduce((a, r) => Math.max(a, r.total), 0) || 1;

  if (rows.length === 0) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-semibold text-navy">
          Payment method summary
        </h2>
        <p className="text-sm text-muted">No paid invoices yet.</p>
      </section>
    );
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-navy">
        Payment method summary
      </h2>
      <Card className="!p-4">
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.key}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="font-medium text-ink">{r.label}</span>
                <span className="font-mono text-muted">
                  {r.count} invoice{r.count === 1 ? "" : "s"} ·{" "}
                  {formatCurrency(r.total, currencySymbol)}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-navy transition-[width]"
                  style={{
                    width: `${Math.max(6, (r.total / max) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}
