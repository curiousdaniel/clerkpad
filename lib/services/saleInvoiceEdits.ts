import type { AuctionDB, AuctionEvent, Sale } from "@/lib/db";
import {
  recalculateAndPersistInvoice,
  roundMoney,
  upsertInvoiceForBidder,
} from "@/lib/services/invoiceLogic";

export async function removeSaleFromInvoice(
  db: AuctionDB,
  event: AuctionEvent,
  saleId: number,
  invoiceId: number
): Promise<void> {
  const inv = await db.invoices.get(invoiceId);
  if (inv?.status === "paid") {
    throw new Error("Cannot remove lines from a paid invoice.");
  }
  const sale = await db.sales.get(saleId);
  if (sale?.id == null || sale.invoiceId !== invoiceId) {
    throw new Error("This line is not on the current invoice.");
  }
  await db.sales.update(saleId, { invoiceId: null });
  await recalculateAndPersistInvoice(db, invoiceId, event);
}

export type SaleCorrectionInput = {
  description: string;
  quantity: number;
  /** Line hammer total (unit × quantity). */
  amount: number;
  paddleNumber: number;
  bidderId: number;
  consignor?: string;
  consignorId: number | null;
  clerkInitials: string;
};

/**
 * Updates a sale from invoice detail. Unpaid invoice only.
 * If the bidder changes, the sale is unallocated and re-attached via upsertInvoiceForBidder.
 */
export async function persistSaleCorrection(
  db: AuctionDB,
  event: AuctionEvent,
  saleId: number,
  viewingInvoiceId: number,
  input: SaleCorrectionInput
): Promise<void> {
  const inv = await db.invoices.get(viewingInvoiceId);
  if (inv?.id == null) throw new Error("Invoice not found.");
  if (inv.status === "paid") {
    throw new Error("Mark the invoice unpaid before editing sale lines.");
  }

  const sale = await db.sales.get(saleId);
  if (sale?.id == null) throw new Error("Sale not found.");
  if (sale.invoiceId !== viewingInvoiceId) {
    throw new Error("This sale is no longer on this invoice. Close and reopen the invoice.");
  }

  const qty = Math.max(1, Math.floor(Number(input.quantity)) || 1);
  const amount = roundMoney(input.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error("Line total must be a non-negative number.");
  }

  const bidderChanged = input.bidderId !== sale.bidderId;

  const next: Sale = {
    ...sale,
    description: input.description.trim(),
    quantity: qty,
    amount,
    paddleNumber: input.paddleNumber,
    bidderId: input.bidderId,
    consignor: input.consignor?.trim() || undefined,
    clerkInitials: input.clerkInitials.trim().toUpperCase().slice(0, 3),
  };
  if (input.consignorId != null) {
    next.consignorId = input.consignorId;
  } else {
    delete next.consignorId;
  }

  if (bidderChanged) {
    next.invoiceId = null;
  }

  await db.sales.put(next);

  if (bidderChanged) {
    await recalculateAndPersistInvoice(db, viewingInvoiceId, event);
    await upsertInvoiceForBidder(db, event, input.bidderId);
  } else {
    await recalculateAndPersistInvoice(db, viewingInvoiceId, event);
  }
}
