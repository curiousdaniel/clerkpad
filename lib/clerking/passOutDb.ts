import type { AuctionDB } from "@/lib/db";
import {
  displayLotNumberFromParts,
  maxLotSuffix,
  nextSuffix,
} from "@/lib/utils/lotSuffix";

/** Suffix for the lot row we are about to create in pass-out mode (DB is source of truth). */
export async function computeNewPassOutLotSuffix(
  db: AuctionDB,
  eventId: number,
  baseLotNumber: number
): Promise<string> {
  const rows = await db.lots
    .where("[eventId+baseLotNumber]")
    .equals([eventId, baseLotNumber])
    .toArray();
  if (rows.length === 0) return "";
  const maxS = maxLotSuffix(rows.map((r) => r.lotSuffix));
  return nextSuffix(maxS);
}

/** Display string for the *next* line after current DB state (for form refresh). */
export async function nextPassOutLineDisplay(
  db: AuctionDB,
  eventId: number,
  baseLotNumber: number
): Promise<string> {
  const rows = await db.lots
    .where("[eventId+baseLotNumber]")
    .equals([eventId, baseLotNumber])
    .toArray();
  if (rows.length === 0) {
    return displayLotNumberFromParts(baseLotNumber, "");
  }
  const maxS = maxLotSuffix(rows.map((r) => r.lotSuffix));
  const nextS = nextSuffix(maxS);
  return displayLotNumberFromParts(baseLotNumber, nextS);
}
