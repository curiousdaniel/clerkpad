import type { Transaction } from "dexie";
import type {
  AuctionDB,
  Bidder,
  Consignor,
  EventLocalBranding,
  Invoice,
  Lot,
  Sale,
} from "@/lib/db";
import { isCloudSyncApplying } from "@/lib/db/syncApplyGuard";

async function touchParentEvent(
  trans: Transaction,
  eventId: number | undefined
): Promise<void> {
  if (isCloudSyncApplying()) return;
  if (trans.mode === "versionchange") return;
  if (eventId == null || !Number.isFinite(eventId)) return;
  await trans.table("events").update(eventId, { updatedAt: new Date() });
}

function eventIdFromUpdate(
  modifications: object,
  previous: { eventId?: number }
): number | undefined {
  const m = modifications as { eventId?: number };
  return typeof m.eventId === "number" ? m.eventId : previous.eventId;
}

/** Keeps `events.updatedAt` in sync with child edits so cloud auto-refresh can defer snapshot replace until push. */
export function registerParentEventTouchHooks(db: AuctionDB): void {
  db.bidders.hook("creating", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as Bidder).eventId)
  );
  db.bidders.hook("updating", (mods, _pk, obj, trans) =>
    touchParentEvent(trans, eventIdFromUpdate(mods, obj as Bidder))
  );
  db.bidders.hook("deleting", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as Bidder).eventId)
  );

  db.consignors.hook("creating", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as Consignor).eventId)
  );
  db.consignors.hook("updating", (mods, _pk, obj, trans) =>
    touchParentEvent(trans, eventIdFromUpdate(mods, obj as Consignor))
  );
  db.consignors.hook("deleting", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as Consignor).eventId)
  );

  db.lots.hook("creating", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as Lot).eventId)
  );
  db.lots.hook("updating", (mods, _pk, obj, trans) =>
    touchParentEvent(trans, eventIdFromUpdate(mods, obj as Lot))
  );
  db.lots.hook("deleting", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as Lot).eventId)
  );

  db.sales.hook("creating", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as Sale).eventId)
  );
  db.sales.hook("updating", (mods, _pk, obj, trans) =>
    touchParentEvent(trans, eventIdFromUpdate(mods, obj as Sale))
  );
  db.sales.hook("deleting", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as Sale).eventId)
  );

  db.invoices.hook("creating", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as Invoice).eventId)
  );
  db.invoices.hook("updating", (mods, _pk, obj, trans) =>
    touchParentEvent(trans, eventIdFromUpdate(mods, obj as Invoice))
  );
  db.invoices.hook("deleting", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as Invoice).eventId)
  );

  db.eventLocalBranding.hook("creating", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as EventLocalBranding).eventId)
  );
  db.eventLocalBranding.hook("updating", (mods, _pk, obj, trans) =>
    touchParentEvent(
      trans,
      eventIdFromUpdate(mods, obj as EventLocalBranding)
    )
  );
  db.eventLocalBranding.hook("deleting", (_pk, obj, trans) =>
    touchParentEvent(trans, (obj as EventLocalBranding).eventId)
  );
}
