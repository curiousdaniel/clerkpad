import type { AuctionDB } from "@/lib/db";

export type ChildTableForEventTouch = "bidders" | "consignors";

/**
 * Bump `events.updatedAt` in the same IndexedDB transaction as child writes so
 * `hasUnpushedLocalEventMetadataEdits` is true before the child row is visible
 * to other transactions. Defers cloud snapshot replace until push (avoids flash
 * then revert). Hook-only `trans.on("complete")` bumps are too late.
 */
export async function mutateWithParentEventTouch<T>(
  db: AuctionDB,
  eventId: number,
  childTable: ChildTableForEventTouch,
  mutate: () => Promise<T>
): Promise<T> {
  const ct = db[childTable];
  return db.transaction("rw", [db.events, ct], async () => {
    await db.events.update(eventId, { updatedAt: new Date() });
    return await mutate();
  });
}
