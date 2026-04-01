"use client";

import type { Bidder, Invoice, Sale } from "@/lib/db";
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

export function InvoiceDetailModal({
  open,
  invoice,
  bidder,
  sales,
  currencySymbol,
  onClose,
  onPrint,
  onMarkPaid,
}: {
  open: boolean;
  invoice: Invoice | null;
  bidder: Bidder | undefined;
  sales: Sale[];
  currencySymbol: string;
  onClose: () => void;
  onPrint: () => void;
  onMarkPaid: () => void;
}) {
  if (!invoice) return null;

  const sym = currencySymbol;

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
          <div className="rounded-lg border border-navy/10 bg-surface/50 p-3">
            <p className="font-medium text-navy">
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

        <div className="overflow-x-auto rounded-lg border border-navy/10">
          <table className="w-full min-w-[400px] text-sm">
            <thead className="bg-surface">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-navy">
                  Lot #
                </th>
                <th className="px-3 py-2 text-left font-semibold text-navy">
                  Description
                </th>
                <th className="px-3 py-2 text-right font-semibold text-navy">
                  Qty
                </th>
                <th className="px-3 py-2 text-right font-semibold text-navy">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-4 text-center text-muted">
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
            <dt className="text-muted">Subtotal</dt>
            <dd>{formatCurrency(invoice.subtotal, sym)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted">Tax</dt>
            <dd>{formatCurrency(invoice.taxAmount, sym)}</dd>
          </div>
          <div className="flex justify-between gap-4 text-base font-semibold text-navy">
            <dt>Total</dt>
            <dd>{formatCurrency(invoice.total, sym)}</dd>
          </div>
        </dl>
      </div>
    </Modal>
  );
}
