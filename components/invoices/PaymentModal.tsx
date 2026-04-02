"use client";

import { useState, useEffect } from "react";
import type { Invoice } from "@/lib/db";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { PAYMENT_METHODS } from "@/lib/utils/constants";

export function PaymentModal({
  open,
  invoice,
  onClose,
  onPaid,
}: {
  open: boolean;
  invoice: Invoice | null;
  onClose: () => void;
  onPaid: (invoice: Invoice) => void;
}) {
  const { db } = useUserDb();
  const [method, setMethod] = useState<string>("cash");

  useEffect(() => {
    if (open) setMethod("cash");
  }, [open, invoice?.id]);

  async function confirm() {
    if (invoice?.id == null || !db) return;
    await db.invoices.update(invoice.id, {
      status: "paid",
      paymentMethod: method as "cash" | "check" | "credit_card" | "other",
      paymentDate: new Date(),
    });
    onPaid(invoice);
    onClose();
  }

  return (
    <Modal
      open={open}
      title="Mark as paid"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void confirm()}>
            Confirm payment
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-muted">
        Record payment for invoice{" "}
        <span className="font-mono font-medium text-ink">
          {invoice?.invoiceNumber}
        </span>
        .
      </p>
      <div>
        <label
          htmlFor="pay-method"
          className="mb-1 block text-sm font-medium text-ink"
        >
          Payment method
        </label>
        <select
          id="pay-method"
          className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
        >
          {PAYMENT_METHODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
    </Modal>
  );
}
