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

/** Short inputs that may share a row (sm:grid-cols-2) when consecutive in tab order. */
const NARROW_SALE_FIELD_IDS = new Set<SaleFieldId>([
  "lot",
  "price",
  "paddle",
  "quantity",
  "consignor",
  "initials",
]);

export function isNarrowSaleField(id: SaleFieldId): boolean {
  return NARROW_SALE_FIELD_IDS.has(id);
}

export const DEFAULT_SALE_FIELD_ORDER: SaleFieldId[] = [
  ...ALL_SALE_FIELD_IDS,
];

const LABELS: Record<SaleFieldId, string> = {
  lot: "Lot number",
  price: "Hammer per unit",
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

/**
 * Cached snapshot for useSyncExternalStore: getSnapshot must return the same
 * array reference until localStorage (or our digest) actually changes.
 */
let clientSnapshot: SaleFieldId[] = DEFAULT_SALE_FIELD_ORDER;
let clientStorageDigest: string | null = null;

export function readSaleFieldOrder(): SaleFieldId[] {
  if (typeof window === "undefined") return DEFAULT_SALE_FIELD_ORDER;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const digest = raw === null ? "__null__" : raw;
    if (digest === clientStorageDigest) return clientSnapshot;
    clientStorageDigest = digest;
    const parsed = JSON.parse(raw ?? "null") as unknown;
    clientSnapshot = normalizeSaleFieldOrder(parsed);
    return clientSnapshot;
  } catch {
    clientStorageDigest = "__error__";
    clientSnapshot = DEFAULT_SALE_FIELD_ORDER;
    return clientSnapshot;
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
