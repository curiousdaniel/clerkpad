import type {
  AuctionDB,
  AuctionEvent,
  Bidder,
  Invoice,
  Lot,
  Sale,
} from "@/lib/db";
import { APP_VERSION } from "@/lib/utils/constants";

export const EXPORT_VERSION = 1;

export type EventExportPayload = {
  exportVersion: number;
  exportDate: string;
  appVersion: string;
  event: Omit<AuctionEvent, "id" | "updatedAt" | "createdAt"> & {
    createdAt: string;
  };
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

function iso(d: Date) {
  return d.toISOString();
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
    ...eventFields
  } = event;

  return {
    exportVersion: EXPORT_VERSION,
    exportDate: iso(new Date()),
    appVersion,
    event: {
      ...eventFields,
      createdAt: iso(event.createdAt),
    },
    bidders: bidders.map(({ id, eventId: _ev, ...b }) => ({
      ...b,
      legacyId: id,
      createdAt: iso(b.createdAt),
      updatedAt: iso(b.updatedAt),
    })),
    lots: lots.map(({ id, eventId: _ev, ...l }) => ({
      ...l,
      legacyId: id,
      createdAt: iso(l.createdAt),
      updatedAt: iso(l.updatedAt),
    })),
    sales: sales.map((s) => {
      const { id: _id, eventId: _ev, lotId, bidderId, ...rest } = s;
      return {
        ...rest,
        createdAt: iso(s.createdAt),
        legacyLotId: lotId,
        legacyBidderId: bidderId,
      };
    }),
    invoices: invoices.map((inv) => {
      const { id: _id, eventId: _ev, bidderId, ...rest } = inv;
      return {
        ...rest,
        generatedAt: iso(inv.generatedAt),
        paymentDate: inv.paymentDate ? iso(inv.paymentDate) : undefined,
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
  if (o.exportVersion !== EXPORT_VERSION) {
    throw new Error(`Unsupported export version: ${String(o.exportVersion)}`);
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
    exportDate: iso(new Date()),
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
      const eventId = (await db.events.add({
        name: ev.name,
        description: ev.description,
        organizationName: ev.organizationName,
        taxRate: ev.taxRate,
        currencySymbol: ev.currencySymbol,
        createdAt: parseDate(ev.createdAt),
        updatedAt: now,
      })) as number;

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
        const { legacyBidderId, generatedAt, paymentDate, ...rest } = inv;
        const bidderId =
          legacyBidderId != null
            ? bidderMap.get(legacyBidderId)
            : undefined;
        if (bidderId == null) {
          throw new Error(
            "Invoice references unknown bidder — export may be incomplete"
          );
        }
        await db.invoices.add({
          ...rest,
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
  );
}
