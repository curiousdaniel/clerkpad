import type { AuctionDB, Lot } from "@/lib/db";

/** Match lots regardless of displayLotNumber padding (e.g. "1" vs "0001"). */
export async function findLotByEventBaseAndSuffix(
  db: AuctionDB,
  eventId: number,
  baseLotNumber: number,
  lotSuffix: string
): Promise<Lot | undefined> {
  const suf = lotSuffix.toUpperCase();
  const rows = await db.lots
    .where("[eventId+baseLotNumber]")
    .equals([eventId, baseLotNumber])
    .toArray();
  return rows.find((l) => (l.lotSuffix ?? "").toUpperCase() === suf);
}
