import { describe, expect, it } from "vitest";
import type { AuctionEvent, Bidder, Invoice, Sale } from "@/lib/db";
import { buildAccountingCsvRows } from "./accountingCsv";

const baseEvent: AuctionEvent = {
  defaultConsignorCommissionRate: 0,
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
        invoiceId: 100,
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
        invoiceId: 100,
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

  it("allocates tax across sales and manual lines using invoice BP rate", () => {
    const sales: Sale[] = [
      {
        id: 1,
        eventId: 1,
        lotId: 10,
        bidderId: 20,
        invoiceId: 100,
        displayLotNumber: "0001",
        paddleNumber: 5,
        description: "A",
        quantity: 1,
        amount: 100,
        clerkInitials: "X",
        createdAt: new Date("2026-02-01"),
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
        subtotal: 100,
        buyersPremiumAmount: 10,
        taxAmount: 16,
        total: 176,
        status: "unpaid",
        generatedAt: new Date("2026-02-03"),
        buyersPremiumRate: 0.1,
        taxRate: 0.1,
        manualLines: [{ id: "m1", description: "Fee", amount: 50 }],
      },
    ];

    const rows = buildAccountingCsvRows(baseEvent, sales, bidders, invoices);
    expect(rows).toHaveLength(2);
    const taxSum = rows.reduce((a, r) => a + Number(r[7]), 0);
    expect(taxSum).toBe(16);
    const totalSum = rows.reduce((a, r) => a + Number(r[8]), 0);
    expect(totalSum).toBe(176);
    const adj = rows.find((r) => r[1] === "ADJ");
    expect(adj).toBeDefined();
    expect(adj![3]).toBe("Pat Lee");
    expect(Number(adj![4])).toBe(50);
  });
});
