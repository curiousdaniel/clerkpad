import type { AuctionEvent, Consignor } from "@/lib/db";
import { roundMoney } from "@/lib/services/invoiceLogic";

export function effectiveCommissionRate(
  event: AuctionEvent,
  consignor: Consignor | undefined | null
): number {
  const d = event.defaultConsignorCommissionRate ?? 0;
  if (
    consignor &&
    typeof consignor.commissionRate === "number" &&
    Number.isFinite(consignor.commissionRate)
  ) {
    return Math.max(0, Math.min(1, consignor.commissionRate));
  }
  return Math.max(0, Math.min(1, d));
}

export function lineCommission(hammer: number, rate: number): number {
  return roundMoney(Math.max(0, hammer) * Math.max(0, Math.min(1, rate)));
}

export function formatConsignorDisplayLabel(c: Consignor): string {
  return `#${c.consignorNumber} — ${c.name}`;
}
