import type { AuctionEvent, Bidder, Consignor, Invoice, Lot, Sale } from "@/lib/db";
import { resolveConsignorForSale } from "@/lib/services/consignorAttribution";
import {
  effectiveCommissionRate,
  lineCommission,
} from "@/lib/services/consignorCommission";
import { computeInvoiceFromSubtotal, roundMoney } from "@/lib/services/invoiceLogic";
import { suffixRank } from "@/lib/utils/lotSuffix";
import { PAYMENT_METHODS } from "@/lib/utils/constants";

export type EventSummaryStats = {
  totalRevenue: number;
  lotsSold: number;
  lotsPassed: number;
  lotsUnsold: number;
  lotsWithdrawn: number;
  bidderCount: number;
  activeBidderCount: number;
  avgSaleAmount: number;
  highestSale: { displayLotNumber: string; amount: number } | null;
  totalTaxCollected: number;
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
};

export function computeEventSummary(
  sales: Sale[],
  lots: Lot[],
  bidders: Bidder[],
  invoices: Invoice[]
): EventSummaryStats {
  const totalRevenue = roundMoney(
    sales.reduce((a, s) => a + s.amount, 0)
  );
  const lotsSold = lots.filter((l) => l.status === "sold").length;
  const lotsPassed = lots.filter((l) => l.status === "passed").length;
  const lotsUnsold = lots.filter((l) => l.status === "unsold").length;
  const lotsWithdrawn = lots.filter((l) => l.status === "withdrawn").length;

  const activeBidderCount = new Set(sales.map((s) => s.bidderId)).size;
  const avgSaleAmount =
    sales.length > 0 ? roundMoney(totalRevenue / sales.length) : 0;

  let highestSale: EventSummaryStats["highestSale"] = null;
  for (const s of sales) {
    if (!highestSale || s.amount > highestSale.amount) {
      highestSale = { displayLotNumber: s.displayLotNumber, amount: s.amount };
    }
  }

  const paidInvoices = invoices.filter((i) => i.status === "paid");
  const unpaidInvoices = invoices.filter((i) => i.status === "unpaid");

  const totalTaxCollected = roundMoney(
    paidInvoices.reduce((a, i) => a + i.taxAmount, 0)
  );
  const totalInvoiced = roundMoney(
    invoices.reduce((a, i) => a + i.total, 0)
  );
  const totalPaid = roundMoney(
    paidInvoices.reduce((a, i) => a + i.total, 0)
  );
  const totalOutstanding = roundMoney(
    unpaidInvoices.reduce((a, i) => a + i.total, 0)
  );

  return {
    totalRevenue,
    lotsSold,
    lotsPassed,
    lotsUnsold,
    lotsWithdrawn,
    bidderCount: bidders.length,
    activeBidderCount,
    avgSaleAmount,
    highestSale,
    totalTaxCollected,
    totalInvoiced,
    totalPaid,
    totalOutstanding,
  };
}

export type BidderReportRow = {
  bidderId: number;
  paddleNumber: number;
  name: string;
  itemsWon: number;
  subtotal: number;
  tax: number;
  total: number;
  paymentStatus: "Paid" | "Unpaid" | "No invoice";
};

export function buildBidderReportRows(
  bidders: Bidder[],
  sales: Sale[],
  invoices: Invoice[],
  taxRate: number
): BidderReportRow[] {
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

  const rows: BidderReportRow[] = [];

  for (const b of bidders) {
    if (b.id == null) continue;
    const list = salesByBidder.get(b.id) ?? [];
    const subtotal = roundMoney(list.reduce((a, s) => a + s.amount, 0));
    const { taxAmount, total } = computeInvoiceFromSubtotal(subtotal, taxRate);
    const inv = invByBidder.get(b.id);
    let paymentStatus: BidderReportRow["paymentStatus"] = "No invoice";
    if (inv) {
      paymentStatus = inv.status === "paid" ? "Paid" : "Unpaid";
    }
    rows.push({
      bidderId: b.id,
      paddleNumber: b.paddleNumber,
      name: `${b.lastName}, ${b.firstName}`,
      itemsWon: list.length,
      subtotal,
      tax: taxAmount,
      total,
      paymentStatus,
    });
  }

  return rows.sort((a, b) => a.paddleNumber - b.paddleNumber);
}

export type LotReportRow = {
  lotId: number;
  displayLotNumber: string;
  baseLotNumber: number;
  lotSuffix: string;
  description: string;
  consignor: string;
  quantity: number;
  status: Lot["status"];
  winningBid: number | null;
  winningPaddle: number | null;
  clerk: string;
};

export function compareLotsForReport(a: Lot, b: Lot): number {
  if (a.baseLotNumber !== b.baseLotNumber) {
    return a.baseLotNumber - b.baseLotNumber;
  }
  return suffixRank(a.lotSuffix) - suffixRank(b.lotSuffix);
}

export function buildLotReportRows(lots: Lot[], sales: Sale[]): LotReportRow[] {
  const saleByLotId = new Map<number, Sale>();
  for (const s of sales) {
    saleByLotId.set(s.lotId, s);
  }

  const sorted = [...lots].sort(compareLotsForReport);

  return sorted.map((lot) => {
    const sale = lot.id != null ? saleByLotId.get(lot.id) : undefined;
    const sold = lot.status === "sold" && sale;
    return {
      lotId: lot.id ?? -1,
      displayLotNumber: lot.displayLotNumber,
      baseLotNumber: lot.baseLotNumber,
      lotSuffix: lot.lotSuffix,
      description: lot.description,
      consignor: lot.consignor ?? "",
      quantity: lot.quantity,
      status: lot.status,
      winningBid: sold ? sale.amount : null,
      winningPaddle: sold ? sale.paddleNumber : null,
      clerk: sold ? sale.clerkInitials : "",
    };
  });
}

export type ConsignorReportRow = {
  /** Stable key for CSV / UI; "unassigned" when sales could not be matched uniquely. */
  key: string;
  consignorNumber: number | null;
  name: string;
  lotsSold: number;
  grossHammer: number;
  commission: number;
  netToConsignor: number;
  /** Effective rate used (0–1), volume-weighted for the row. */
  effectiveRate: number;
};

export type ConsignorCommissionEventTotals = {
  grossHammer: number;
  totalCommission: number;
  netToConsignors: number;
  lotsSold: number;
};

export function buildConsignorReportRows(
  event: AuctionEvent,
  consignors: Consignor[],
  lots: Lot[],
  sales: Sale[]
): ConsignorReportRow[] {
  const lotById = new Map<number, Lot>();
  for (const l of lots) {
    if (l.id != null) lotById.set(l.id, l);
  }

  type Agg = {
    key: string;
    consignorNumber: number | null;
    name: string;
    lotsSold: number;
    grossHammer: number;
    commission: number;
  };

  const byKey = new Map<string, Agg>();

  function bump(
    key: string,
    consignorNumber: number | null,
    name: string,
    hammer: number,
    comm: number
  ) {
    const cur = byKey.get(key);
    if (cur) {
      cur.lotsSold += 1;
      cur.grossHammer = roundMoney(cur.grossHammer + hammer);
      cur.commission = roundMoney(cur.commission + comm);
    } else {
      byKey.set(key, {
        key,
        consignorNumber,
        name,
        lotsSold: 1,
        grossHammer: roundMoney(hammer),
        commission: roundMoney(comm),
      });
    }
  }

  for (const s of sales) {
    const lot = lotById.get(s.lotId);
    const resolved = resolveConsignorForSale(s, lot, consignors);
    const rate = effectiveCommissionRate(event, resolved);
    const comm = lineCommission(s.amount, rate);

    if (resolved) {
      const key = `c:${resolved.id ?? resolved.consignorNumber}`;
      bump(
        key,
        resolved.consignorNumber,
        resolved.name,
        s.amount,
        comm
      );
    } else {
      bump("unassigned", null, "Unassigned / unmatched", s.amount, comm);
    }
  }

  const rows: ConsignorReportRow[] = Array.from(byKey.values()).map((a) => {
    const net = roundMoney(a.grossHammer - a.commission);
    const effectiveRate =
      a.grossHammer > 0 ? roundMoney(a.commission / a.grossHammer) : 0;
    return {
      key: a.key,
      consignorNumber: a.consignorNumber,
      name: a.name,
      lotsSold: a.lotsSold,
      grossHammer: a.grossHammer,
      commission: a.commission,
      netToConsignor: net,
      effectiveRate,
    };
  });

  rows.sort((a, b) => {
    if (a.key === "unassigned") return 1;
    if (b.key === "unassigned") return -1;
    const an = a.consignorNumber ?? 0;
    const bn = b.consignorNumber ?? 0;
    return an - bn;
  });

  return rows;
}

export function computeConsignorCommissionEventTotals(
  rows: ConsignorReportRow[]
): ConsignorCommissionEventTotals {
  return {
    grossHammer: roundMoney(rows.reduce((a, r) => a + r.grossHammer, 0)),
    totalCommission: roundMoney(rows.reduce((a, r) => a + r.commission, 0)),
    netToConsignors: roundMoney(rows.reduce((a, r) => a + r.netToConsignor, 0)),
    lotsSold: rows.reduce((a, r) => a + r.lotsSold, 0),
  };
}

export type PaymentMethodBreakdownRow = {
  key: string;
  label: string;
  count: number;
  total: number;
};

export function buildPaymentMethodBreakdown(
  invoices: Invoice[]
): PaymentMethodBreakdownRow[] {
  const paid = invoices.filter((i) => i.status === "paid");
  const map = new Map<string, { count: number; total: number }>();
  for (const inv of paid) {
    const key = inv.paymentMethod ?? "other";
    const cur = map.get(key) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total = roundMoney(cur.total + inv.total);
    map.set(key, cur);
  }
  const labelFor = (k: string) =>
    PAYMENT_METHODS.find((p) => p.value === k)?.label ?? k;
  return Array.from(map.entries())
    .map(([key, v]) => ({
      key,
      label: labelFor(key),
      count: v.count,
      total: v.total,
    }))
    .sort((a, b) => b.total - a.total);
}
