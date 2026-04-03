import type {
  AuctionDB,
  AuctionEvent,
  Bidder,
  Invoice,
  Lot,
  Sale,
} from "@/lib/db";
import { APP_VERSION } from "@/lib/utils/constants";
import { toDate } from "@/lib/utils/coerceDate";
import { newEventSyncId } from "@/lib/utils/syncId";
import { roundMoney } from "@/lib/services/invoiceLogic";

export const EXPORT_VERSION = 2;
export const EXPORT_VERSION_LEGACY = 1;

/** JSON shape for `event` inside export (no local `id` / `updatedAt`). */
export type EventExportEventShape = Omit<
  AuctionEvent,
  "id" | "updatedAt" | "createdAt" | "lastCloudPushAt" | "lastCloudPullAt"
> & {
  createdAt: string;
  lastCloudPushAt?: string;
  lastCloudPullAt?: string;
  /** v1 exports omit these */
  syncId?: string;
  buyersPremiumRate?: number;
};

export type EventExportPayload = {
  exportVersion: number;
  exportDate: string;
  appVersion: string;
  event: EventExportEventShape;
  bidders: Array<
    Omit<Bidder, "id" | "eventId" | "createdAt" | "updatedAt"> & {
      legacyId?: number;
      createdAt: string;
      updatedAt: string;
    }
  >;
  lots: Array<
    Omit<Lot, "id" | "eventId" | "createdAt" | "updatedAt"> & {
      legacyId?: number;
      createdAt: string;
      updatedAt: string;
    }
  >;
  sales: Array<
    Omit<Sale, "id" | "eventId" | "lotId" | "bidderId" | "createdAt"> & {
      createdAt: string;
      legacyLotId?: number;
      legacyBidderId?: number;
    }
  >;
  invoices: Array<
    Omit<
      Invoice,
      "id" | "eventId" | "bidderId" | "generatedAt" | "paymentDate"
    > & {
      generatedAt: string;
      paymentDate?: string;
      legacyBidderId?: number;
    }
  >;
};

/** IndexedDB may return Date or ISO string depending on engine / migration path. */
function isoFromStored(
  d: Date | string | number | undefined | null,
  fieldName: string
): string {
  if (d == null) {
    throw new Error(`Missing date for export: ${fieldName}`);
  }
  const parsed = toDate(d);
  if (!parsed) {
    throw new Error(`Invalid date for export (${fieldName})`);
  }
  return parsed.toISOString();
}

function isoOptFromStored(
  d: Date | string | number | undefined | null
): string | undefined {
  if (d == null) return undefined;
  const parsed = toDate(d);
  return parsed ? parsed.toISOString() : undefined;
}

export async function buildEventExport(
  db: AuctionDB,
  eventId: number,
  appVersion: string = APP_VERSION
): Promise<EventExportPayload> {
  const event = await db.events.get(eventId);
  if (!event || event.id == null) throw new Error("Event not found");

  const bidders = await db.bidders.where("eventId").equals(eventId).toArray();
  const lots = await db.lots.where("eventId").equals(eventId).toArray();
  const sales = await db.sales.where("eventId").equals(eventId).toArray();
  const invoices = await db.invoices.where("eventId").equals(eventId).toArray();

  const {
    id: _eid,
    updatedAt: _eu,
    createdAt: _ca,
    lastCloudPushAt: _lcp,
    lastCloudPullAt: _lcl,
    ...eventFields
  } = event;

  return {
    exportVersion: EXPORT_VERSION,
    exportDate: new Date().toISOString(),
    appVersion,
    event: {
      ...eventFields,
      createdAt: isoFromStored(event.createdAt, "event.createdAt"),
      lastCloudPushAt: isoOptFromStored(event.lastCloudPushAt),
      lastCloudPullAt: isoOptFromStored(event.lastCloudPullAt),
    },
    bidders: bidders.map(({ id, eventId: _ev, ...b }) => ({
      ...b,
      legacyId: id,
      createdAt: isoFromStored(b.createdAt, "bidder.createdAt"),
      updatedAt: isoFromStored(b.updatedAt, "bidder.updatedAt"),
    })),
    lots: lots.map(({ id, eventId: _ev, ...l }) => ({
      ...l,
      legacyId: id,
      createdAt: isoFromStored(l.createdAt, "lot.createdAt"),
      updatedAt: isoFromStored(l.updatedAt, "lot.updatedAt"),
    })),
    sales: sales.map((s) => {
      const { id: _id, eventId: _ev, lotId, bidderId, ...rest } = s;
      return {
        ...rest,
        createdAt: isoFromStored(s.createdAt, "sale.createdAt"),
        legacyLotId: lotId,
        legacyBidderId: bidderId,
      };
    }),
    invoices: invoices.map((inv) => {
      const { id: _id, eventId: _ev, bidderId, ...rest } = inv;
      return {
        ...rest,
        generatedAt: isoFromStored(inv.generatedAt, "invoice.generatedAt"),
        paymentDate: inv.paymentDate
          ? isoOptFromStored(inv.paymentDate)
          : undefined,
        legacyBidderId: bidderId,
      };
    }),
  };
}

export function downloadJson(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseDate(s: string): Date {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
  return d;
}

export function parseEventExportPayload(raw: unknown): EventExportPayload {
  if (raw == null || typeof raw !== "object") {
    throw new Error("Invalid JSON: expected an object");
  }
  const o = raw as Record<string, unknown>;
  const v = o.exportVersion;
  if (v !== EXPORT_VERSION && v !== EXPORT_VERSION_LEGACY) {
    throw new Error(`Unsupported export version: ${String(v)}`);
  }
  if (typeof o.event !== "object" || o.event == null) {
    throw new Error("Missing event");
  }
  if (!Array.isArray(o.bidders) || !Array.isArray(o.lots)) {
    throw new Error("Missing bidders or lots arrays");
  }
  const sales = Array.isArray(o.sales) ? o.sales : [];
  const invoices = Array.isArray(o.invoices) ? o.invoices : [];
  return {
    ...(o as EventExportPayload),
    exportVersion: v as number,
    sales: sales as EventExportPayload["sales"],
    invoices: invoices as EventExportPayload["invoices"],
  };
}

export type ImportSummary = {
  eventId: number;
  bidders: number;
  lots: number;
  sales: number;
  invoices: number;
};

export type FullDatabaseExport = {
  fullExportVersion: number;
  exportDate: string;
  appVersion: string;
  events: EventExportPayload[];
};

export async function buildFullDatabaseExport(
  db: AuctionDB,
  appVersion: string = APP_VERSION
): Promise<FullDatabaseExport> {
  const eventRows = await db.events.orderBy("id").toArray();
  const events: EventExportPayload[] = [];
  for (const e of eventRows) {
    if (e.id != null) {
      events.push(await buildEventExport(db, e.id, appVersion));
    }
  }
  return {
    fullExportVersion: 1,
    exportDate: new Date().toISOString(),
    appVersion,
    events,
  };
}

export function parseFullDatabaseExport(raw: unknown): FullDatabaseExport {
  if (raw == null || typeof raw !== "object") {
    throw new Error("Invalid JSON: expected an object");
  }
  const o = raw as Record<string, unknown>;
  if (o.fullExportVersion !== 1) {
    throw new Error(
      "Not a ClerkBid full-database export (expected fullExportVersion: 1)"
    );
  }
  if (!Array.isArray(o.events)) {
    throw new Error("Missing events array");
  }
  const events = o.events.map((item, i) => {
    try {
      return parseEventExportPayload(item);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new Error(`Event entry ${i + 1}: ${msg}`);
    }
  });
  return {
    fullExportVersion: 1,
    exportDate:
      typeof o.exportDate === "string"
        ? o.exportDate
        : new Date().toISOString(),
    appVersion:
      typeof o.appVersion === "string" ? o.appVersion : "unknown",
    events,
  };
}

export type FullImportResult = {
  imported: number;
  failures: { index: number; message: string }[];
};

/** Imports each event as a new event (append). Continues on per-event errors. */
export async function importFullDatabaseEvents(
  db: AuctionDB,
  data: FullDatabaseExport
): Promise<FullImportResult> {
  const failures: FullImportResult["failures"] = [];
  let imported = 0;
  for (let i = 0; i < data.events.length; i++) {
    try {
      await importEventFromPayload(db, data.events[i]);
      imported++;
    } catch (e) {
      failures.push({
        index: i,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return { imported, failures };
}

function invoiceAmountsFromImportPayload(
  raw: {
    subtotal: number;
    taxAmount: number;
    total: number;
    buyersPremiumAmount?: number;
  },
  eventBuyersPremiumRate: number
): Pick<Invoice, "subtotal" | "buyersPremiumAmount" | "taxAmount" | "total"> {
  const bpRate = Math.max(0, eventBuyersPremiumRate);
  let subtotal = raw.subtotal;
  let buyersPremiumAmount = raw.buyersPremiumAmount;
  if (typeof buyersPremiumAmount !== "number" || !Number.isFinite(buyersPremiumAmount)) {
    const oldTaxable = subtotal;
    const hammer = roundMoney(oldTaxable / (1 + bpRate));
    buyersPremiumAmount = roundMoney(oldTaxable - hammer);
    subtotal = hammer;
  } else {
    buyersPremiumAmount = roundMoney(buyersPremiumAmount);
    subtotal = roundMoney(subtotal);
  }
  return { subtotal, buyersPremiumAmount, taxAmount: raw.taxAmount, total: raw.total };
}

function eventRowFromPayload(
  ev: EventExportEventShape,
  syncId: string,
  buyersPremiumRate: number,
  now: Date,
  lastCloudPushAt?: Date,
  lastCloudPullAt?: Date
): Omit<AuctionEvent, "id"> {
  return {
    name: ev.name,
    description: ev.description,
    organizationName: ev.organizationName,
    taxRate: ev.taxRate,
    currencySymbol: ev.currencySymbol,
    buyersPremiumRate,
    syncId,
    lastCloudPushAt,
    lastCloudPullAt,
    createdAt: parseDate(ev.createdAt),
    updatedAt: now,
  };
}

async function insertChildrenForEvent(
  db: AuctionDB,
  eventId: number,
  payload: EventExportPayload,
  eventBuyersPremiumRate: number
): Promise<ImportSummary> {
  const bidderMap = new Map<number, number>();
  let bidderIndex = 0;
  for (const b of payload.bidders) {
    const { legacyId, createdAt, updatedAt, ...rest } = b;
    const newId = (await db.bidders.add({
      ...rest,
      eventId,
      createdAt: parseDate(createdAt),
      updatedAt: parseDate(updatedAt),
    })) as number;
    const key = legacyId ?? bidderIndex;
    bidderMap.set(key, newId);
    bidderIndex++;
  }

  const lotMap = new Map<number, number>();
  let lotIndex = 0;
  for (const l of payload.lots) {
    const { legacyId, createdAt, updatedAt, ...rest } = l;
    const newId = (await db.lots.add({
      ...rest,
      eventId,
      createdAt: parseDate(createdAt),
      updatedAt: parseDate(updatedAt),
    })) as number;
    const key = legacyId ?? lotIndex;
    lotMap.set(key, newId);
    lotIndex++;
  }

  for (const s of payload.sales) {
    const { legacyLotId, legacyBidderId, createdAt, ...rest } = s;
    const lotId =
      legacyLotId != null ? lotMap.get(legacyLotId) : undefined;
    const bidderId =
      legacyBidderId != null ? bidderMap.get(legacyBidderId) : undefined;
    if (lotId == null || bidderId == null) {
      throw new Error(
        "Sale references unknown lot or bidder — export may be incomplete"
      );
    }
    await db.sales.add({
      ...rest,
      eventId,
      lotId,
      bidderId,
      createdAt: parseDate(createdAt),
    });
  }

  for (const inv of payload.invoices) {
    const {
      legacyBidderId,
      generatedAt,
      paymentDate,
      subtotal,
      taxAmount,
      total,
      buyersPremiumAmount,
      ...meta
    } = inv;
    const bidderId =
      legacyBidderId != null
        ? bidderMap.get(legacyBidderId)
        : undefined;
    if (bidderId == null) {
      throw new Error(
        "Invoice references unknown bidder — export may be incomplete"
      );
    }
    const amounts = invoiceAmountsFromImportPayload(
      { subtotal, taxAmount, total, buyersPremiumAmount },
      eventBuyersPremiumRate
    );
    await db.invoices.add({
      ...meta,
      ...amounts,
      eventId,
      bidderId,
      generatedAt: parseDate(generatedAt),
      paymentDate: paymentDate ? parseDate(paymentDate) : undefined,
    });
  }

  return {
    eventId,
    bidders: payload.bidders.length,
    lots: payload.lots.length,
    sales: payload.sales.length,
    invoices: payload.invoices.length,
  };
}

/** Creates a new event and inserts related rows with remapped FKs. */
export async function importEventFromPayload(
  db: AuctionDB,
  payload: EventExportPayload
): Promise<ImportSummary> {
  return db.transaction(
    "rw",
    [db.events, db.bidders, db.lots, db.sales, db.invoices],
    async () => {
      const ev = payload.event;
      const now = new Date();
      const syncId =
        typeof ev.syncId === "string" && ev.syncId.length > 0
          ? ev.syncId
          : newEventSyncId();
      const buyersPremiumRate =
        typeof ev.buyersPremiumRate === "number" &&
        Number.isFinite(ev.buyersPremiumRate)
          ? Math.max(0, ev.buyersPremiumRate)
          : 0;
      const lastCloudPushAt = ev.lastCloudPushAt
        ? parseDate(String(ev.lastCloudPushAt))
        : undefined;
      const lastCloudPullAt = ev.lastCloudPullAt
        ? parseDate(String(ev.lastCloudPullAt))
        : undefined;

      const eventId = (await db.events.add(
        eventRowFromPayload(
          ev,
          syncId,
          buyersPremiumRate,
          now,
          lastCloudPushAt,
          lastCloudPullAt
        )
      )) as number;

      return insertChildrenForEvent(db, eventId, payload, buyersPremiumRate);
    }
  );
}

/**
 * Replaces all child rows for an existing event and updates the event row from payload.
 * Used when restoring from cloud without changing local numeric event id.
 */
export async function replaceEventFromPayload(
  db: AuctionDB,
  eventId: number,
  payload: EventExportPayload
): Promise<ImportSummary> {
  return db.transaction(
    "rw",
    [db.events, db.bidders, db.lots, db.sales, db.invoices],
    async () => {
      const existing = await db.events.get(eventId);
      if (existing == null) throw new Error("Event not found");

      await db.invoices.where("eventId").equals(eventId).delete();
      await db.sales.where("eventId").equals(eventId).delete();
      await db.lots.where("eventId").equals(eventId).delete();
      await db.bidders.where("eventId").equals(eventId).delete();

      const ev = payload.event;
      const now = new Date();
      const syncId =
        typeof ev.syncId === "string" && ev.syncId.length > 0
          ? ev.syncId
          : existing.syncId;
      const buyersPremiumRate =
        typeof ev.buyersPremiumRate === "number" &&
        Number.isFinite(ev.buyersPremiumRate)
          ? Math.max(0, ev.buyersPremiumRate)
          : existing.buyersPremiumRate;

      const lastCloudPushAt = ev.lastCloudPushAt
        ? parseDate(String(ev.lastCloudPushAt))
        : existing.lastCloudPushAt;
      const lastCloudPullAt = ev.lastCloudPullAt
        ? parseDate(String(ev.lastCloudPullAt))
        : existing.lastCloudPullAt;

      await db.events.update(
        eventId,
        eventRowFromPayload(
          ev,
          syncId,
          buyersPremiumRate,
          now,
          lastCloudPushAt,
          lastCloudPullAt
        )
      );

      return insertChildrenForEvent(db, eventId, payload, buyersPremiumRate);
    }
  );
}
