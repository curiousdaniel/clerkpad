import Dexie, { type Table } from "dexie";

export interface AuctionEvent {
  id?: number;
  name: string;
  description?: string;
  organizationName: string;
  taxRate: number;
  currencySymbol: string;
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
}

export class AuctionDB extends Dexie {
  events!: Table<AuctionEvent>;
  bidders!: Table<Bidder>;
  lots!: Table<Lot>;
  sales!: Table<Sale>;
  invoices!: Table<Invoice>;
  settings!: Table<AppSettings>;

  constructor() {
    super("AuctionManagerDB");

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
  }
}

export const db = new AuctionDB();
