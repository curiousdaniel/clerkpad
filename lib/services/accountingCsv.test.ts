import { describe, expect, it } from "vitest";
import type { AuctionEvent, Bidder, Invoice, Sale } from "@/lib/db";
import { buildAccountingCsvRows } from "./accountingCsv";

const baseEvent: AuctionEvent = {
  id: 1,
  name: "Sale",
  organizationName: "Org",
  taxRate: 0.1,
  buyersPremiumRate: 0.1,
  currencySymbol: "$",
  syncId: "00000000-0000-4000-8000-000000000001",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("buildAccountingCsvRows", () => {
  it("allocates tax across two sales for one bidder", () => {
    const sales: Sale[] = [
      {
        id: 1,
        eventId: 1,
        lotId: 10,
        bidderId: 20,
        displayLotNumber: "0001",
        paddleNumber: 5,
        description: "A",
        quantity: 1,
        amount: 100,
        clerkInitials: "X",
        createdAt: new Date("2026-02-01"),
      },
      {
        id: 2,
        eventId: 1,
        lotId: 11,
        bidderId: 20,
        displayLotNumber: "0002",
        paddleNumber: 5,
        description: "B",
        quantity: 1,
        amount: 50,
        clerkInitials: "X",
        createdAt: new Date("2026-02-02"),
      },
    ];
    const bidders: Bidder[] = [
      {
        id: 20,
        eventId: 1,
        paddleNumber: 5,
        firstName: "Pat",
        lastName: "Lee",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const invoices: Invoice[] = [
      {
        id: 100,
        eventId: 1,
        bidderId: 20,
        invoiceNumber: "1-001",
        subtotal: 150,
        buyersPremiumAmount: 15,
        taxAmount: 16.5,
        total: 181.5,
        status: "unpaid",
        generatedAt: new Date(),
      },
    ];

    const rows = buildAccountingCsvRows(baseEvent, sales, bidders, invoices);
    expect(rows).toHaveLength(2);
    const taxSum = rows.reduce((a, r) => a + Number(r[7]), 0);
    expect(taxSum).toBe(16.5);
    const totalSum = rows.reduce((a, r) => a + Number(r[8]), 0);
    expect(totalSum).toBe(181.5);
  });
});
