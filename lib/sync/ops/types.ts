export type SyncOpPushItem = {
  opId: string;
  eventSyncId: string;
  opType: string;
  clientCreatedAt: string;
  body: unknown;
};

export type SalePutBody = {
  saleSyncKey: string;
  displayLotNumber: string;
  paddleNumber: number;
  description: string;
  consignor?: string;
  consignorNumber?: number | null;
  quantity: number;
  amount: number;
  clerkInitials: string;
  createdAt: string;
  invoiceSyncKey?: string | null;
};

export type SaleDeleteBody = { saleSyncKey: string };

export type InvoicePutBody = {
  invoiceSyncKey: string;
  invoiceNumber: string;
  paddleNumber: number;
  status: "paid" | "unpaid";
  subtotal: number;
  buyersPremiumAmount: number;
  taxAmount: number;
  total: number;
  generatedAt: string;
  buyersPremiumRate?: number | null;
  taxRate?: number | null;
  manualLines?: Array<{ id: string; description: string; amount: number }>;
  paymentMethod?: "cash" | "check" | "credit_card" | "other";
  paymentDate?: string | null;
};

export type InvoicePatchBody = {
  invoiceSyncKey: string;
  patch: Record<string, unknown>;
  recalculate?: boolean;
};

export const SYNC_OP_TYPES = [
  "sale.put",
  "sale.delete",
  "invoice.put",
  "invoice.patch",
] as const;
