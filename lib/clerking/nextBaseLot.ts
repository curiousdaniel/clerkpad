import type { Lot } from "@/lib/db";
import type { AuctionDB } from "@/lib/db";
import { suffixRank } from "@/lib/utils/lotSuffix";
import { formatBaseLotDisplay, parseLotDisplay } from "./lotParse";

/** Catalog order: numeric base ascending, then suffix (empty, then A, B, …). */
export function compareLotsCatalogOrder(a: Lot, b: Lot): number {
  if (a.baseLotNumber !== b.baseLotNumber) {
    return a.baseLotNumber - b.baseLotNumber;
  }
  return suffixRank(a.lotSuffix ?? "") - suffixRank(b.lotSuffix ?? "");
}

function isNextSuggestionCandidate(lot: Lot): boolean {
  return lot.status === "unsold";
}

function lotMatchesParsedDisplay(
  lot: Lot,
  parsed: { base: number; suffix: string }
): boolean {
  return (
    lot.baseLotNumber === parsed.base &&
    (lot.lotSuffix ?? "").toUpperCase() === parsed.suffix
  );
}

/**
 * Returns the next lot display to suggest from an in-memory list (already sorted),
 * or null to fall back to max base + 1.
 */
export function pickNextSuggestedLotDisplay(
  sortedLots: Lot[],
  afterSoldDisplay?: string | null
): string | null {
  if (afterSoldDisplay) {
    const parsed = parseLotDisplay(afterSoldDisplay);
    if (parsed) {
      const idx = sortedLots.findIndex((l) =>
        lotMatchesParsedDisplay(l, parsed)
      );
      const start = idx >= 0 ? idx : -1;
      for (let j = start + 1; j < sortedLots.length; j++) {
        const lot = sortedLots[j]!;
        if (isNextSuggestionCandidate(lot)) {
          return lot.displayLotNumber;
        }
      }
      return null;
    }
  }

  for (const lot of sortedLots) {
    if (isNextSuggestionCandidate(lot)) {
      return lot.displayLotNumber;
    }
  }
  return null;
}

export async function getNextSuggestedBaseLotNumber(
  db: AuctionDB,
  eventId: number
): Promise<number> {
  const lots = await db.lots.where("eventId").equals(eventId).toArray();
  if (lots.length === 0) return 1;
  const max = Math.max(...lots.map((l) => l.baseLotNumber));
  return max + 1;
}

export type NextSuggestedLotOptions = {
  /** After recording this sale, suggest the next open catalog lot after it (by catalog order). */
  afterSoldDisplay?: string;
};

export async function getNextSuggestedLotDisplay(
  db: AuctionDB,
  eventId: number,
  options?: NextSuggestedLotOptions
): Promise<string> {
  const lots = await db.lots.where("eventId").equals(eventId).toArray();
  const sorted = [...lots].sort(compareLotsCatalogOrder);
  const picked = pickNextSuggestedLotDisplay(
    sorted,
    options?.afterSoldDisplay ?? null
  );
  if (picked != null) return picked;
  const n = await getNextSuggestedBaseLotNumber(db, eventId);
  return formatBaseLotDisplay(n);
}
