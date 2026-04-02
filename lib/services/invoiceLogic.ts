import type { AuctionDB, AuctionEvent, Bidder, Invoice, Sale } from "@/lib/db";
import type { InvoicePdfInput } from "@/lib/services/invoicePdf";

export function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeInvoiceFromSubtotal(
  subtotal: number,
  taxRate: number
): { subtotal: number; taxAmount: number; total: number } {
  const s = roundMoney(subtotal);
  const taxAmount = roundMoney(s * taxRate);
  const total = roundMoney(s + taxAmount);
  return { subtotal: s, taxAmount, total };
}

export function formatInvoiceNumber(eventId: number, seq: number): string {
  return `${eventId}-${String(seq).padStart(3, "0")}`;
}

export async function findInvoiceForBidder(
  db: AuctionDB,
  eventId: number,
  bidderId: number
): Promise<Invoice | undefined> {
  const rows = await db.invoices.where("eventId").equals(eventId).toArray();
  return rows.find((i) => i.bidderId === bidderId);
}

export async function nextInvoiceSequence(
  db: AuctionDB,
  eventId: number
): Promise<number> {
  const all = await db.invoices.where("eventId").equals(eventId).toArray();
  let max = 0;
  for (const inv of all) {
    const part = inv.invoiceNumber.split("-").pop();
    const seq = part ? parseInt(part, 10) : NaN;
    if (Number.isFinite(seq) && seq > max) max = seq;
  }
  return max + 1;
}

export async function bidderIdsWithSales(
  db: AuctionDB,
  eventId: number
): Promise<number[]> {
  const sales = await db.sales.where("eventId").equals(eventId).toArray();
  return Array.from(new Set(sales.map((s) => s.bidderId)));
}

export type UpsertResult =
  | { kind: "created"; invoiceId: number }
  | { kind: "updated"; invoiceId: number }
  | { kind: "skipped_paid" }
  | { kind: "no_sales" };

/**
 * One invoice row per (event, bidder). Unpaid → recalc & update. Paid → skip.
 * Creates new invoice if none exists.
 */
export async function upsertInvoiceForBidder(
  db: AuctionDB,
  event: AuctionEvent,
  bidderId: number
): Promise<UpsertResult> {
  const eventId = event.id!;
  const sales = await db.sales
    .where("eventId")
    .equals(eventId)
    .filter((s) => s.bidderId === bidderId)
    .toArray();
  if (sales.length === 0) return { kind: "no_sales" };

  const subtotal = roundMoney(sales.reduce((a, s) => a + s.amount, 0));
  const { taxAmount, total } = computeInvoiceFromSubtotal(
    subtotal,
    event.taxRate
  );

  const existing = await findInvoiceForBidder(db, eventId, bidderId);
  const now = new Date();

  if (existing?.id != null) {
    if (existing.status === "paid") {
      return { kind: "skipped_paid" };
    }
    await db.invoices.update(existing.id, {
      subtotal,
      taxAmount,
      total,
      generatedAt: now,
    });
    return { kind: "updated", invoiceId: existing.id };
  }

  const seq = await nextInvoiceSequence(db, eventId);
  const invoiceNumber = formatInvoiceNumber(eventId, seq);
  const id = await db.invoices.add({
    eventId,
    bidderId,
    invoiceNumber,
    subtotal,
    taxAmount,
    total,
    status: "unpaid",
    generatedAt: now,
  });
  return { kind: "created", invoiceId: id as number };
}

export async function generateAllInvoicesForEvent(
  db: AuctionDB,
  eventId: number
): Promise<{
  created: number;
  updated: number;
  skippedPaid: number;
  noSales: number;
}> {
  const event = await db.events.get(eventId);
  if (!event?.id) throw new Error("Event not found");

  const bidderIds = await bidderIdsWithSales(db, eventId);

  let created = 0;
  let updated = 0;
  let skippedPaid = 0;
  let noSales = 0;

  for (const bidderId of bidderIds) {
    const r = await upsertInvoiceForBidder(db, event, bidderId);
    if (r.kind === "created") created++;
    else if (r.kind === "updated") updated++;
    else if (r.kind === "skipped_paid") skippedPaid++;
    else if (r.kind === "no_sales") noSales++;
  }

  return { created, updated, skippedPaid, noSales };
}

export async function getSalesForBidderInvoice(
  db: AuctionDB,
  eventId: number,
  bidderId: number
) {
  const rows = await db.sales
    .where("eventId")
    .equals(eventId)
    .filter((s) => s.bidderId === bidderId)
    .toArray();
  rows.sort((a, b) =>
    a.displayLotNumber.localeCompare(b.displayLotNumber, undefined, {
      numeric: true,
    })
  );
  return rows;
}

export function toInvoicePdfInput(
  invoice: Invoice,
  event: AuctionEvent,
  bidder: Bidder,
  sales: Sale[]
): InvoicePdfInput {
  return {
    organizationName: event.organizationName,
    eventName: event.name,
    invoiceNumber: invoice.invoiceNumber,
    generatedAt: invoice.generatedAt,
    taxRate: event.taxRate,
    currencySymbol: event.currencySymbol,
    bidderName: `${bidder.firstName} ${bidder.lastName}`,
    paddleNumber: bidder.paddleNumber,
    phone: bidder.phone,
    email: bidder.email,
    status: invoice.status,
    paymentMethod: invoice.paymentMethod,
    paymentDate: invoice.paymentDate,
    lines: sales.map((s) => ({
      displayLotNumber: s.displayLotNumber,
      description: s.description,
      quantity: s.quantity,
      amount: s.amount,
    })),
    subtotal: invoice.subtotal,
    taxAmount: invoice.taxAmount,
    total: invoice.total,
  };
}

export async function loadInvoicePdfInput(
  db: AuctionDB,
  invoiceId: number
): Promise<InvoicePdfInput | null> {
  const inv = await db.invoices.get(invoiceId);
  if (inv?.id == null) return null;
  const [event, bidder] = await Promise.all([
    db.events.get(inv.eventId),
    db.bidders.get(inv.bidderId),
  ]);
  if (event?.id == null || bidder?.id == null) return null;
  const sales = await getSalesForBidderInvoice(db, inv.eventId, inv.bidderId);
  return toInvoicePdfInput(inv, event, bidder, sales);
}

/** Bidders who have sales but no invoice row yet for this event. */
export async function bidderIdsPendingFirstInvoice(
  db: AuctionDB,
  eventId: number
): Promise<number[]> {
  const withSales = await bidderIdsWithSales(db, eventId);
  const invs = await db.invoices.where("eventId").equals(eventId).toArray();
  const invoiced = new Set(invs.map((i) => i.bidderId));
  return withSales.filter((id) => !invoiced.has(id));
}
