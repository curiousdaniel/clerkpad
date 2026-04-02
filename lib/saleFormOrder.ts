const STORAGE_KEY = "clerkbid:saleFieldOrder";

/** Dispatched on same window after writeSaleFieldOrder (and storage from other tabs fires storage). */
export const SALE_FIELD_ORDER_CHANGED = "clerkbid:saleFieldOrder";

export const ALL_SALE_FIELD_IDS = [
  "lot",
  "price",
  "paddle",
  "quantity",
  "description",
  "notes",
  "consignor",
  "initials",
] as const;

export type SaleFieldId = (typeof ALL_SALE_FIELD_IDS)[number];

export const DEFAULT_SALE_FIELD_ORDER: SaleFieldId[] = [
  ...ALL_SALE_FIELD_IDS,
];

const LABELS: Record<SaleFieldId, string> = {
  lot: "Lot number",
  price: "Hammer / sell price",
  paddle: "Paddle number",
  quantity: "Quantity",
  description: "Lot description / title",
  notes: "Lot notes / ring",
  consignor: "Consignor",
  initials: "Clerk initials",
};

export function saleFieldLabel(id: SaleFieldId): string {
  return LABELS[id];
}

export function isValidSaleFieldOrder(
  value: unknown
): value is SaleFieldId[] {
  if (!Array.isArray(value) || value.length !== ALL_SALE_FIELD_IDS.length) {
    return false;
  }
  const set = new Set<string>(ALL_SALE_FIELD_IDS);
  const seen = new Set<string>();
  for (const x of value) {
    if (typeof x !== "string" || !set.has(x) || seen.has(x)) return false;
    seen.add(x);
  }
  return seen.size === ALL_SALE_FIELD_IDS.length;
}

export function normalizeSaleFieldOrder(raw: unknown): SaleFieldId[] {
  if (!isValidSaleFieldOrder(raw)) return [...DEFAULT_SALE_FIELD_ORDER];
  return [...raw];
}

export function readSaleFieldOrder(): SaleFieldId[] {
  if (typeof window === "undefined") return [...DEFAULT_SALE_FIELD_ORDER];
  try {
    const raw = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "null"
    ) as unknown;
    return normalizeSaleFieldOrder(raw);
  } catch {
    return [...DEFAULT_SALE_FIELD_ORDER];
  }
}

export function writeSaleFieldOrder(order: SaleFieldId[]): void {
  const normalized = normalizeSaleFieldOrder(order);
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(SALE_FIELD_ORDER_CHANGED));
}

export function tabOrderHelpFragment(order: SaleFieldId[]): string {
  return order.map((id) => saleFieldLabel(id)).join(" → ");
}
