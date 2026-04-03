import type { Consignor, Lot, Sale } from "@/lib/db";

function normalizeLabel(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Conservative parsing: leading `#N` or a line that is only digits.
 * Does not treat arbitrary embedded numbers as consignor numbers.
 */
export function parseConsignorNumberFromLabel(text: string): number | null {
  const t = text.trim();
  const hash = t.match(/^#\s*(\d+)\b/i);
  if (hash) return parseInt(hash[1]!, 10);
  const onlyNum = t.match(/^\s*(\d+)\s*$/);
  if (onlyNum) return parseInt(onlyNum[1]!, 10);
  return null;
}

/**
 * Map a sold line to a registry consignor, or null for the unassigned bucket.
 * Order: sale.consignorId → number in label → unique case-insensitive name match.
 */
export function resolveConsignorForSale(
  sale: Sale,
  lot: Lot | undefined,
  eventConsignors: Consignor[]
): Consignor | null {
  const byId = new Map<number, Consignor>();
  for (const c of eventConsignors) {
    if (c.id != null) byId.set(c.id, c);
  }

  if (sale.consignorId != null) {
    const linked = byId.get(sale.consignorId);
    if (linked) return linked;
  }

  const raw = (sale.consignor ?? lot?.consignor ?? "").trim();
  if (!raw) return null;

  const num = parseConsignorNumberFromLabel(raw);
  if (num != null) {
    const byNum = eventConsignors.filter((c) => c.consignorNumber === num);
    if (byNum.length === 1) return byNum[0]!;
  }

  const normFull = normalizeLabel(raw);
  const stripped = raw.replace(/^#\s*\d+\s*[—–-]\s*/i, "").trim();
  const normStripped = stripped ? normalizeLabel(stripped) : "";

  const nameHits = eventConsignors.filter((c) => {
    const nn = normalizeLabel(c.name);
    return nn === normFull || (!!normStripped && nn === normStripped);
  });
  if (nameHits.length === 1) return nameHits[0]!;

  return null;
}
