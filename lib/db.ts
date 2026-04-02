import Dexie, { type Table } from "dexie";
import { newEventSyncId } from "@/lib/utils/syncId";

/** Pre–per-user DB; migrated once into the signed-in user's database. */
export const LEGACY_DB_NAME = "AuctionManagerDB";

const STORE_DEF = {
  events: "++id, name, createdAt, syncId",
  bidders:
    "++id, eventId, paddleNumber, [eventId+paddleNumber]",
  lots:
    "++id, eventId, baseLotNumber, lotSuffix, displayLotNumber, status, [eventId+displayLotNumber], [eventId+baseLotNumber]",
  sales:
    "++id, eventId, lotId, bidderId, displayLotNumber, paddleNumber",
  invoices: "++id, eventId, bidderId, status, invoiceNumber",
  settings: "++id",
} as const;

export function sanitizeUserIdForDbName(userId: string): string {
  return userId.replace(/[^a-zA-Z0-9_-]/g, "_");
}

export function userDexieDatabaseName(userId: string): string {
  return `ClerkBid_u_${sanitizeUserIdForDbName(userId)}`;
}

export interface AuctionEvent {
  id?: number;
  name: string;
  description?: string;
  organizationName: string;
  taxRate: number;
  /** 0–1, applied to hammer subtotal before sales tax on invoices. */
  buyersPremiumRate: number;
  currencySymbol: string;
  /** Stable id for cloud backup / sync (UUID). */
  syncId: string;
  lastCloudPushAt?: Date;
  lastCloudPullAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Bidder {
  id?: number;
  eventId: number;
  paddleNumber: number;
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Lot {
  id?: number;
  eventId: number;
  baseLotNumber: number;
  lotSuffix: string;
  displayLotNumber: string;
  description: string;
  consignor?: string;
  /** Ring / clerk notes, shown when clerking. */
  notes?: string;
  quantity: number;
  status: "unsold" | "sold" | "passed" | "withdrawn";
  createdAt: Date;
  updatedAt: Date;
}

export interface Sale {
  id?: number;
  eventId: number;
  lotId: number;
  bidderId: number;
  displayLotNumber: string;
  paddleNumber: number;
  description: string;
  consignor?: string;
  quantity: number;
  amount: number;
  clerkInitials: string;
  createdAt: Date;
}

export interface Invoice {
  id?: number;
  eventId: number;
  bidderId: number;
  invoiceNumber: string;
  subtotal: number;
  taxAmount: number;
  total: number;
  status: "unpaid" | "paid";
  paymentMethod?: "cash" | "check" | "credit_card" | "other";
  paymentDate?: Date;
  generatedAt: Date;
}

export interface AppSettings {
  id?: number;
  currentEventId: number | null;
  lastBackupDate?: Date;
  lastCloudPushAt?: Date;
  lastCloudPullAt?: Date;
  lastBackupNudgeDismissedAt?: Date;
}

export class AuctionDB extends Dexie {
  events!: Table<AuctionEvent>;
  bidders!: Table<Bidder>;
  lots!: Table<Lot>;
  sales!: Table<Sale>;
  invoices!: Table<Invoice>;
  settings!: Table<AppSettings>;

  constructor(userId: string) {
    super(userDexieDatabaseName(userId));
    this.version(1).stores({
      events: "++id, name, createdAt",
      bidders:
        "++id, eventId, paddleNumber, [eventId+paddleNumber]",
      lots:
        "++id, eventId, baseLotNumber, lotSuffix, displayLotNumber, status, [eventId+displayLotNumber], [eventId+baseLotNumber]",
      sales:
        "++id, eventId, lotId, bidderId, displayLotNumber, paddleNumber",
      invoices: "++id, eventId, bidderId, status, invoiceNumber",
      settings: "++id",
    });
    this.version(2)
      .stores(STORE_DEF)
      .upgrade(async (tx) => {
        const evTable = tx.table("events");
        await evTable.toCollection().modify((row: Record<string, unknown>) => {
          if (row.syncId == null || row.syncId === "") {
            row.syncId = newEventSyncId();
          }
          if (row.buyersPremiumRate == null || row.buyersPremiumRate === "") {
            row.buyersPremiumRate = 0;
          }
        });
      });
  }
}

const dbInstanceCache = new Map<string, AuctionDB>();

export function getAuctionDB(userId: string): AuctionDB {
  let d = dbInstanceCache.get(userId);
  if (!d) {
    d = new AuctionDB(userId);
    dbInstanceCache.set(userId, d);
  }
  return d;
}

/** Call on sign-out so another account on this device gets a clean open. */
export function closeAndClearAuctionDbCache(): void {
  dbInstanceCache.forEach((d) => {
    d.close();
  });
  dbInstanceCache.clear();
}

/**
 * One-time: copy legacy single-DB data into this user's DB, then delete legacy.
 */
export async function migrateLegacyToUserDb(userDb: AuctionDB): Promise<void> {
  const exists = await Dexie.exists(LEGACY_DB_NAME);
  if (!exists) return;

  if ((await userDb.events.count()) > 0) return;

  const legacy = new Dexie(LEGACY_DB_NAME);
  legacy.version(1).stores({
    events: "++id, name, createdAt",
    bidders:
      "++id, eventId, paddleNumber, [eventId+paddleNumber]",
    lots:
      "++id, eventId, baseLotNumber, lotSuffix, displayLotNumber, status, [eventId+displayLotNumber], [eventId+baseLotNumber]",
    sales:
      "++id, eventId, lotId, bidderId, displayLotNumber, paddleNumber",
    invoices: "++id, eventId, bidderId, status, invoiceNumber",
    settings: "++id",
  });
  try {
    await legacy.open();
  } catch {
    return;
  }

  try {
    if ((await legacy.table("events").count()) === 0) return;

    const tableNames = [
      "events",
      "bidders",
      "lots",
      "sales",
      "invoices",
      "settings",
    ] as const;

    await userDb.transaction("rw", userDb.tables, async () => {
      for (const name of tableNames) {
        const rows = await legacy.table(name).toArray();
        if (rows.length === 0) continue;
        if (name === "events") {
          for (const r of rows as Record<string, unknown>[]) {
            if (r.syncId == null || r.syncId === "") {
              r.syncId = newEventSyncId();
            }
            if (r.buyersPremiumRate == null) r.buyersPremiumRate = 0;
            await userDb.table(name).add(r as never);
          }
        } else {
          await userDb.table(name).bulkAdd(rows as never[]);
        }
      }
    });

    await legacy.delete();
  } finally {
    legacy.close();
  }
}
