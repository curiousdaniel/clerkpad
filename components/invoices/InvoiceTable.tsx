"use client";

import { FileText, CreditCard } from "lucide-react";
import type { Bidder, Invoice } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatDateOnly } from "@/lib/utils/formatDate";
import { PAYMENT_METHODS } from "@/lib/utils/constants";

export type InvoiceWithBidder = Invoice & { bidder?: Bidder };

function paymentLabel(value: string | undefined): string {
  if (!value) return "—";
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

export function InvoiceTable({
  rows,
  currencySymbol,
  onRowClick,
  onPrint,
  onMarkPaid,
}: {
  rows: InvoiceWithBidder[];
  currencySymbol: string;
  onRowClick: (inv: InvoiceWithBidder) => void;
  onPrint: (inv: InvoiceWithBidder) => void;
  onMarkPaid: (inv: InvoiceWithBidder) => void;
}) {
  const sym = currencySymbol;

  return (
    <div className="overflow-x-auto rounded-xl border border-navy/10 bg-white">
      <table className="w-full min-w-[880px] text-sm">
        <thead className="border-b border-navy/10 bg-surface">
          <tr>
            <th className="px-3 py-2 text-left font-semibold text-navy">
              Invoice #
            </th>
            <th className="px-3 py-2 text-left font-semibold text-navy">
              Bidder
            </th>
            <th className="px-3 py-2 text-right font-semibold text-navy">
              Subtotal
            </th>
            <th className="px-3 py-2 text-right font-semibold text-navy">
              Tax
            </th>
            <th className="px-3 py-2 text-right font-semibold text-navy">
              Total
            </th>
            <th className="px-3 py-2 text-left font-semibold text-navy">
              Status
            </th>
            <th className="px-3 py-2 text-left font-semibold text-navy">
              Payment
            </th>
            <th className="px-3 py-2 text-right font-semibold text-navy">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-navy/10">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-8 text-center text-muted">
                No invoices match this filter.
              </td>
            </tr>
          ) : (
            rows.map((inv) => (
              <tr
                key={inv.id}
                className="cursor-pointer hover:bg-surface/60"
                onClick={() => onRowClick(inv)}
              >
                <td className="px-3 py-2 font-mono font-medium text-navy">
                  {inv.invoiceNumber}
                </td>
                <td className="px-3 py-2">
                  {inv.bidder ? (
                    <>
                      <span className="text-ink">
                        {inv.bidder.firstName} {inv.bidder.lastName}
                      </span>
                      <span className="ml-2 font-mono text-xs text-muted">
                        #{inv.bidder.paddleNumber}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatCurrency(inv.subtotal, sym)}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatCurrency(inv.taxAmount, sym)}
                </td>
                <td className="px-3 py-2 text-right font-mono font-semibold text-gold">
                  {formatCurrency(inv.total, sym)}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={inv.status === "paid" ? "success" : "warning"}>
                    {inv.status}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-muted">
                  {inv.status === "paid" ? (
                    <span className="text-xs">
                      {paymentLabel(inv.paymentMethod)}
                      {inv.paymentDate
                        ? ` · ${formatDateOnly(inv.paymentDate)}`
                        : ""}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  <Button
                    variant="ghost"
                    type="button"
                    className="!p-1.5"
                    aria-label="Print invoice"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPrint(inv);
                    }}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                  {inv.status === "unpaid" ? (
                    <Button
                      variant="ghost"
                      type="button"
                      className="!p-1.5"
                      aria-label="Mark paid"
                      onClick={(e) => {
                        e.stopPropagation();
                        onMarkPaid(inv);
                      }}
                    >
                      <CreditCard className="h-4 w-4" />
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
