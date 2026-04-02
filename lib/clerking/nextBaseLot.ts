import type { AuctionDB } from "@/lib/db";
import { formatBaseLotDisplay } from "./lotParse";

export async function getNextSuggestedBaseLotNumber(
  db: AuctionDB,
  eventId: number
): Promise<number> {
  const lots = await db.lots.where("eventId").equals(eventId).toArray();
  if (lots.length === 0) return 1;
  const max = Math.max(...lots.map((l) => l.baseLotNumber));
  return max + 1;
}

export async function getNextSuggestedLotDisplay(
  db: AuctionDB,
  eventId: number
): Promise<string> {
  const n = await getNextSuggestedBaseLotNumber(db, eventId);
  return formatBaseLotDisplay(n);
}
