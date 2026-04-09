import type { AuctionEvent, Consignor } from "@/lib/db";
import { roundMoney } from "@/lib/services/invoiceLogic";

function eventDefaultCommissionFraction(raw: unknown): number {
  if (raw === null || raw === undefined) return 0;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(1, raw));
  }
  if (typeof raw === "string") {
    const p = parseFloat(raw.trim());
    if (!Number.isFinite(p)) return 0;
    let n = p;
    if (n > 1 && n <= 100) {
      n = n / 100;
    }
    return Math.max(0, Math.min(1, n));
  }
  return 0;
}

/** Consignor override: numeric values keep legacy clamp (>1 becomes 1). Strings may use whole percents (e.g. "12" → 12%). */
function consignorOverrideFraction(raw: unknown): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return Math.max(0, Math.min(1, raw));
  }
  if (typeof raw === "string") {
    const p = parseFloat(raw.trim());
    if (!Number.isFinite(p)) return undefined;
    let n = p;
    if (n > 1 && n <= 100) {
      n = n / 100;
    }
    return Math.max(0, Math.min(1, n));
  }
  return undefined;
}

export function effectiveCommissionRate(
  event: AuctionEvent,
  consignor: Consignor | undefined | null
): number {
  const defaultRate = eventDefaultCommissionFraction(
    event.defaultConsignorCommissionRate
  );
  if (consignor) {
    const c = consignorOverrideFraction(consignor.commissionRate);
    if (c !== undefined) {
      return c;
    }
  }
  return defaultRate;
}

export function lineCommission(hammer: number, rate: number): number {
  return roundMoney(Math.max(0, hammer) * Math.max(0, Math.min(1, rate)));
}

export function formatConsignorDisplayLabel(c: Consignor): string {
  return `#${c.consignorNumber} — ${c.name}`;
}
