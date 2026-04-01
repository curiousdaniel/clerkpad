import { db } from "@/lib/db";
import { getCurrentEventId, setCurrentEventId } from "@/lib/settings";

/** Removes all bidders, lots, sales, and invoices for the event; keeps the event row. */
export async function clearEventDataKeepShell(eventId: number): Promise<void> {
  await db.transaction(
    "rw",
    [db.bidders, db.lots, db.sales, db.invoices],
    async () => {
      await db.bidders.where("eventId").equals(eventId).delete();
      await db.lots.where("eventId").equals(eventId).delete();
      await db.sales.where("eventId").equals(eventId).delete();
      await db.invoices.where("eventId").equals(eventId).delete();
    }
  );
}

export async function deleteEventCascade(eventId: number): Promise<void> {
  await db.transaction(
    "rw",
    [db.bidders, db.lots, db.sales, db.invoices, db.events],
    async () => {
      await db.bidders.where("eventId").equals(eventId).delete();
      await db.lots.where("eventId").equals(eventId).delete();
      await db.sales.where("eventId").equals(eventId).delete();
      await db.invoices.where("eventId").equals(eventId).delete();
      await db.events.delete(eventId);
    }
  );
  const current = await getCurrentEventId();
  if (current === eventId) {
    await setCurrentEventId(null);
  }
}
