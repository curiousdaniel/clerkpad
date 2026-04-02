import type { AuctionEvent, Bidder, Invoice, Sale } from "@/lib/db";
import { roundMoney } from "@/lib/services/invoiceLogic";
import { formatDateOnly } from "@/lib/utils/formatDate";
import { rowsToCsv } from "@/lib/services/csvExporter";

export const ACCOUNTING_CSV_HEADERS = [
  "saleDate",
  "lot",
  "paddle",
  "bidderName",
  "hammer",
  "buyersPremium",
  "lineTaxable",
  "allocatedTax",
  "lineTotal",
  "invoiceNumber",
  "invoiceStatus",
] as const;

export type AccountingCsvRow = (string | number)[];

/**
 * One row per sale. Tax is allocated from the bidder’s invoice in proportion to
 * each line’s taxable amount (hammer × (1 + BP rate)).
 */
export function buildAccountingCsvRows(
  event: AuctionEvent,
  sales: Sale[],
  bidders: Bidder[],
  invoices: Invoice[]
): AccountingCsvRow[] {
  const bpRate = event.buyersPremiumRate ?? 0;
  const bidderById = new Map<number, Bidder>();
  for (const b of bidders) {
    if (b.id != null) bidderById.set(b.id, b);
  }
  const invByBidder = new Map<number, Invoice>();
  for (const inv of invoices) {
    invByBidder.set(inv.bidderId, inv);
  }

  const salesByBidder = new Map<number, Sale[]>();
  for (const s of sales) {
    const list = salesByBidder.get(s.bidderId) ?? [];
    list.push(s);
    salesByBidder.set(s.bidderId, list);
  }

  const lineTaxableBySaleId = new Map<number, number>();
  const taxShareBySaleId = new Map<number, number>();

  for (const [bidderId, list] of Array.from(salesByBidder.entries())) {
    const taxables = list.map((s) => {
      const lt = roundMoney(s.amount * (1 + bpRate));
      lineTaxableBySaleId.set(s.id!, lt);
      return { sale: s, lineTaxable: lt };
    });
    const sumTaxable = roundMoney(taxables.reduce((a, x) => a + x.lineTaxable, 0));
    const inv = invByBidder.get(bidderId);
    if (!inv || sumTaxable <= 0) {
      for (const { sale } of taxables) {
        taxShareBySaleId.set(sale.id!, 0);
      }
      continue;
    }
    let allocated = 0;
    for (let i = 0; i < taxables.length; i++) {
      const { sale, lineTaxable } = taxables[i]!;
      let share: number;
      if (i === taxables.length - 1) {
        share = roundMoney(inv.taxAmount - allocated);
      } else {
        share = roundMoney(inv.taxAmount * (lineTaxable / sumTaxable));
        allocated = roundMoney(allocated + share);
      }
      taxShareBySaleId.set(sale.id!, share);
    }
  }

  const sorted = [...sales].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const out: AccountingCsvRow[] = [];
  for (const s of sorted) {
    if (s.id == null) continue;
    const b = bidderById.get(s.bidderId);
    const name = b ? `${b.firstName} ${b.lastName}` : "";
    const hammer = s.amount;
    const bp = roundMoney(hammer * bpRate);
    const lineTaxable =
      lineTaxableBySaleId.get(s.id) ?? roundMoney(hammer * (1 + bpRate));
    const tax = taxShareBySaleId.get(s.id) ?? 0;
    const lineTotal = roundMoney(lineTaxable + tax);
    const inv = invByBidder.get(s.bidderId);
    out.push([
      formatDateOnly(s.createdAt),
      s.displayLotNumber,
      s.paddleNumber,
      name,
      hammer,
      bp,
      lineTaxable,
      tax,
      lineTotal,
      inv?.invoiceNumber ?? "",
      inv?.status ?? "",
    ]);
  }
  return out;
}

export function buildAccountingCsvString(
  event: AuctionEvent,
  sales: Sale[],
  bidders: Bidder[],
  invoices: Invoice[]
): string {
  const rows = buildAccountingCsvRows(event, sales, bidders, invoices);
  return rowsToCsv([...ACCOUNTING_CSV_HEADERS], rows);
}
