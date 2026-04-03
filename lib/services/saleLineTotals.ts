import type { Sale } from "@/lib/db";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Quantity used for line math (at least 1). */
export function saleLineQuantity(sale: Pick<Sale, "quantity">): number {
  return Math.max(1, Math.floor(Number(sale.quantity)) || 1);
}

/**
 * Unit hammer (per item). `Sale.amount` is the full line hammer (unit × quantity).
 */
export function saleUnitHammer(sale: Pick<Sale, "amount" | "quantity">): number {
  const q = saleLineQuantity(sale);
  return round2(sale.amount / q);
}

/** Stored line hammer total (same as `sale.amount` with current clerking rules). */
export function saleLineHammerTotal(sale: Pick<Sale, "amount">): number {
  return round2(sale.amount);
}
