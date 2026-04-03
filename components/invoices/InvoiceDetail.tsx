"use client";

import type { Bidder, Invoice, Sale } from "@/lib/db";
import { saleUnitHammer } from "@/lib/services/saleLineTotals";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatDateOnly, formatDateTime } from "@/lib/utils/formatDate";
import { PAYMENT_METHODS } from "@/lib/utils/constants";

function paymentLabel(value: string | undefined): string {
  if (!value) return "—";
  return PAYMENT_METHODS.find((p) => p.value === value)?.label ?? value;
}

function buyersPremiumLineLabel(buyersPremiumRate: number): string {
  if (buyersPremiumRate <= 0) return "Buyer's premium";
  const pct = `${(buyersPremiumRate * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
  return `Buyer's premium (${pct})`;
}

function taxLineLabel(taxRate: number): string {
  if (taxRate <= 0) return "Tax";
  const pct = `${(taxRate * 100).toFixed(2).replace(/\.?0+$/, "")}%`;
  return `Tax (${pct})`;
}

export function InvoiceDetailModal({
  open,
  invoice,
  bidder,
  sales,
  currencySymbol,
  buyersPremiumRate,
  taxRate,
  onClose,
  onPrint,
  onMarkPaid,
}: {
  open: boolean;
  invoice: Invoice | null;
  bidder: Bidder | undefined;
  sales: Sale[];
  currencySymbol: string;
  buyersPremiumRate: number;
  taxRate: number;
  onClose: () => void;
  onPrint: () => void;
  onMarkPaid: () => void;
}) {
  if (!invoice) return null;

  const sym = currencySymbol;
  const showBpLine =
    invoice.buyersPremiumAmount > 0 || buyersPremiumRate > 0;

  return (
    <Modal
      open={open}
      title={`Invoice ${invoice.invoiceNumber}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" type="button" onClick={onPrint}>
            Print PDF
          </Button>
          {invoice.status === "unpaid" ? (
            <Button type="button" onClick={onMarkPaid}>
              Mark as paid
            </Button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={invoice.status === "paid" ? "success" : "warning"}>
            {invoice.status}
          </Badge>
          <span className="text-muted">
            Generated {formatDateTime(invoice.generatedAt)}
          </span>
        </div>

        {bidder ? (
          <div className="rounded-lg border border-navy/10 bg-surface/50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
            <p className="font-medium text-navy dark:text-slate-100">
              {bidder.firstName} {bidder.lastName}
            </p>
            <p className="font-mono text-muted">Paddle #{bidder.paddleNumber}</p>
            {bidder.phone ? (
              <p className="text-muted">{bidder.phone}</p>
            ) : null}
            {bidder.email ? (
              <p className="text-muted">{bidder.email}</p>
            ) : null}
          </div>
        ) : null}

        {invoice.status === "paid" ? (
          <p className="text-muted">
            Paid {invoice.paymentDate ? formatDateOnly(invoice.paymentDate) : ""}{" "}
            · {paymentLabel(invoice.paymentMethod)}
          </p>
        ) : null}

        <div className="overflow-x-auto rounded-lg border border-navy/10 dark:border-slate-700">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="bg-surface dark:bg-slate-800/80">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-navy dark:text-slate-200">
                  Lot #
                </th>
                <th className="px-3 py-2 text-left font-semibold text-navy dark:text-slate-200">
                  Description
                </th>
                <th className="px-3 py-2 text-right font-semibold text-navy dark:text-slate-200">
                  Qty
                </th>
                <th className="px-3 py-2 text-right font-semibold text-navy dark:text-slate-200">
                  Unit
                </th>
                <th className="px-3 py-2 text-right font-semibold text-navy dark:text-slate-200">
                  Line total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10 dark:divide-slate-700">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-4 text-center text-muted">
                    No line items
                  </td>
                </tr>
              ) : (
                sales.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 font-mono">{s.displayLotNumber}</td>
                    <td className="px-3 py-2">{s.description}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {s.quantity}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(saleUnitHammer(s), sym)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      {formatCurrency(s.amount, sym)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <dl className="space-y-1 border-t border-navy/10 pt-3 text-right font-mono">
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Hammer subtotal</dt>
            <dd>{formatCurrency(invoice.subtotal, sym)}</dd>
          </div>
          {showBpLine ? (
            <div className="flex justify-between gap-4">
              <dt className="text-muted">
                {buyersPremiumLineLabel(buyersPremiumRate)}
              </dt>
              <dd>{formatCurrency(invoice.buyersPremiumAmount, sym)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <dt className="text-muted">{taxLineLabel(taxRate)}</dt>
            <dd>{formatCurrency(invoice.taxAmount, sym)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-base font-semibold text-navy dark:text-slate-100">
            <dt>Total</dt>
            <dd>{formatCurrency(invoice.total, sym)}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
