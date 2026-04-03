"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { AuctionDB, Consignor } from "@/lib/db";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

export function useConsignorsForEvent(eventId: number | null | undefined) {
  const { db, ready } = useUserDb();

  return useLiveQuery(
    async () =>
      liveQueryGuard("useConsignorsForEvent", async () => {
        if (!ready || !db || eventId == null) return [];
        return db.consignors
          .where("eventId")
          .equals(eventId)
          .sortBy("consignorNumber");
      }, []),
    [ready, db, eventId]
  );
}

export async function getSuggestedConsignorNumber(
  db: AuctionDB,
  eventId: number
): Promise<number> {
  const all = await db.consignors.where("eventId").equals(eventId).toArray();
  if (all.length === 0) return 1;
  return Math.max(...all.map((c) => c.consignorNumber)) + 1;
}

export async function countSalesForConsignor(
  db: AuctionDB,
  consignorId: number
): Promise<number> {
  return db.sales.where("consignorId").equals(consignorId).count();
}

export type ConsignorRow = Consignor;
