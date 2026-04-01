"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import type { Bidder } from "@/lib/db";

export type BidderRow = Bidder & {
  totalSpent: number;
  itemsWon: number;
};

export function useBiddersForEvent(eventId: number | null | undefined) {
  return useLiveQuery(
    async () => {
      if (eventId == null) return [];
      const bidders = await db.bidders
        .where("eventId")
        .equals(eventId)
        .sortBy("paddleNumber");
      const sales = await db.sales.where("eventId").equals(eventId).toArray();
      const byBidder = new Map<number, { spent: number; n: number }>();
      for (const s of sales) {
        const cur = byBidder.get(s.bidderId) ?? { spent: 0, n: 0 };
        cur.spent += s.amount;
        cur.n += 1;
        byBidder.set(s.bidderId, cur);
      }
      return bidders.map((b) => {
        const agg = b.id != null ? byBidder.get(b.id) : undefined;
        return {
          ...b,
          totalSpent: agg?.spent ?? 0,
          itemsWon: agg?.n ?? 0,
        } satisfies BidderRow;
      });
    },
    [eventId]
  );
}

export async function getSuggestedPaddleNumber(
  eventId: number
): Promise<number> {
  const all = await db.bidders.where("eventId").equals(eventId).toArray();
  if (all.length === 0) return 1;
  return Math.max(...all.map((b) => b.paddleNumber)) + 1;
}

export async function countSalesForBidder(bidderId: number): Promise<number> {
  return db.sales.where("bidderId").equals(bidderId).count();
}
