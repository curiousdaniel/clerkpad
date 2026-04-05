import type { AuctionEvent, Bidder, Invoice, Sale } from "@/lib/db";
import {
  effectiveInvoiceBuyersPremiumRate,
  roundMoney,
} from "@/lib/services/invoiceLogic";
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

type TaxKey = `sale:${number}` | `manual:${string}`;

/**
 * One row per sale plus one row per invoice manual line. Tax is allocated per
 * invoice in proportion to each line’s weight: sales use hammer × (1 + invoice
 * effective BP rate); manual lines use abs(amount) (post-BP adjustments).
 */
export function buildAccountingCsvRows(
  event: AuctionEvent,
  sales: Sale[],
  bidders: Bidder[],
  invoices: Invoice[]
): AccountingCsvRow[] {
  const defaultBpRate = event.buyersPremiumRate ?? 0;
  const bidderById = new Map<number, Bidder>();
  for (const b of bidders) {
    if (b.id != null) bidderById.set(b.id, b);
  }
  const invById = new Map<number, Invoice>();
  for (const inv of invoices) {
    if (inv.id != null) invById.set(inv.id, inv);
  }

  const salesByInvoiceId = new Map<number, Sale[]>();
  const unallocated: Sale[] = [];
  for (const s of sales) {
    if (s.invoiceId == null) {
      unallocated.push(s);
    } else {
      const list = salesByInvoiceId.get(s.invoiceId) ?? [];
      list.push(s);
      salesByInvoiceId.set(s.invoiceId, list);
    }
  }

  const taxShareByKey = new Map<TaxKey, number>();
  const lineTaxableByKey = new Map<TaxKey, number>();

  function allocateTaxForInvoice(inv: Invoice, list: Sale[]) {
    if (inv.id == null) return;
    const bpRate = effectiveInvoiceBuyersPremiumRate(inv, event);
    type Entry = { key: TaxKey; weight: number };
    const entries: Entry[] = [];

    for (const s of list) {
      if (s.id == null) continue;
      const key: TaxKey = `sale:${s.id}`;
      const w = roundMoney(s.amount * (1 + bpRate));
      lineTaxableByKey.set(key, w);
      entries.push({ key, weight: w });
    }

    const manualLines = inv.manualLines ?? [];
    for (const m of manualLines) {
      const key: TaxKey = `manual:${m.id}`;
      const w = roundMoney(Math.abs(m.amount));
      lineTaxableByKey.set(key, w);
      entries.push({ key, weight: w });
    }

    const sumW = roundMoney(entries.reduce((a, e) => a + e.weight, 0));
    if (sumW <= 0) {
      for (const e of entries) {
        taxShareByKey.set(e.key, 0);
      }
      return;
    }

    let allocated = 0;
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i]!;
      let share: number;
      if (i === entries.length - 1) {
        share = roundMoney(inv.taxAmount - allocated);
      } else {
        share = roundMoney(inv.taxAmount * (e.weight / sumW));
        allocated = roundMoney(allocated + share);
      }
      taxShareByKey.set(e.key, share);
    }
  }

  for (const inv of invoices) {
    if (inv.id == null) continue;
    const list = salesByInvoiceId.get(inv.id) ?? [];
    allocateTaxForInvoice(inv, list);
  }

  for (const s of unallocated) {
    if (s.id == null) continue;
    const key = `sale:${s.id}` as TaxKey;
    lineTaxableByKey.set(
      key,
      roundMoney(s.amount * (1 + defaultBpRate))
    );
    taxShareByKey.set(key, 0);
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
    const inv =
      s.invoiceId != null ? invById.get(s.invoiceId) : undefined;
    const bpRate =
      inv != null
        ? effectiveInvoiceBuyersPremiumRate(inv, event)
        : defaultBpRate;
    const hammer = s.amount;
    const bp = roundMoney(hammer * bpRate);
    const key = `sale:${s.id}` as TaxKey;
    const lineTaxable =
      lineTaxableByKey.get(key) ?? roundMoney(hammer * (1 + bpRate));
    const tax = taxShareByKey.get(key) ?? 0;
    const lineTotal = roundMoney(lineTaxable + tax);
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

  const manualRows: {
    inv: Invoice;
    line: NonNullable<Invoice["manualLines"]>[number];
    sortDate: Date;
  }[] = [];
  for (const inv of invoices) {
    if (inv.id == null) continue;
    const lines = inv.manualLines ?? [];
    for (const m of lines) {
      manualRows.push({ inv, line: m, sortDate: inv.generatedAt });
    }
  }
  manualRows.sort(
    (a, b) => a.sortDate.getTime() - b.sortDate.getTime()
  );

  for (const { inv, line: m } of manualRows) {
    const b = bidderById.get(inv.bidderId);
    const name = b ? `${b.firstName} ${b.lastName}` : "";
    const key = `manual:${m.id}` as TaxKey;
    const lineTaxable =
      lineTaxableByKey.get(key) ?? roundMoney(Math.abs(m.amount));
    const tax = taxShareByKey.get(key) ?? 0;
    const lineTotal = roundMoney(m.amount + tax);
    out.push([
      formatDateOnly(inv.generatedAt),
      "ADJ",
      b?.paddleNumber ?? "",
      name,
      m.amount,
      0,
      lineTaxable,
      tax,
      lineTotal,
      inv.invoiceNumber,
      inv.status,
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
