import { describe, expect, it } from "vitest";
import {
  buildPaymentMethodBreakdown,
  compareLotsForReport,
  computeEventSummary,
} from "./reportCalculator";
import type { Invoice, Lot, Sale } from "@/lib/db";

describe("computeEventSummary", () => {
  it("handles empty inputs", () => {
    const s = computeEventSummary([], [], [], []);
    expect(s.totalRevenue).toBe(0);
    expect(s.bidderCount).toBe(0);
    expect(s.activeBidderCount).toBe(0);
    expect(s.highestSale).toBeNull();
  });

  it("sums revenue and finds highest sale", () => {
    const sales: Sale[] = [
      {
        id: 1,
        eventId: 1,
        lotId: 1,
        bidderId: 1,
        displayLotNumber: "0001",
        paddleNumber: 1,
        description: "A",
        quantity: 1,
        amount: 50,
        clerkInitials: "AB",
        createdAt: new Date(),
      },
      {
        id: 2,
        eventId: 1,
        lotId: 2,
        bidderId: 2,
        displayLotNumber: "0002",
        paddleNumber: 2,
        description: "B",
        quantity: 1,
        amount: 100,
        clerkInitials: "AB",
        createdAt: new Date(),
      },
    ];
    const s = computeEventSummary(sales, [], [], []);
    expect(s.totalRevenue).toBe(150);
    expect(s.highestSale?.amount).toBe(100);
    expect(s.activeBidderCount).toBe(2);
  });

  it("totals paid tax and outstanding", () => {
    const invoices: Invoice[] = [
      {
        id: 1,
        eventId: 1,
        bidderId: 1,
        invoiceNumber: "1-001",
        subtotal: 100,
        taxAmount: 8,
        total: 108,
        status: "paid",
        paymentMethod: "cash",
        generatedAt: new Date(),
      },
      {
        id: 2,
        eventId: 1,
        bidderId: 2,
        invoiceNumber: "1-002",
        subtotal: 50,
        taxAmount: 4,
        total: 54,
        status: "unpaid",
        generatedAt: new Date(),
      },
    ];
    const s = computeEventSummary([], [], [], invoices);
    expect(s.totalTaxCollected).toBe(8);
    expect(s.totalPaid).toBe(108);
    expect(s.totalOutstanding).toBe(54);
    expect(s.totalInvoiced).toBe(162);
  });
});

describe("compareLotsForReport", () => {
  it("orders by base then suffix", () => {
    const a: Lot = {
      id: 1,
      eventId: 1,
      baseLotNumber: 1,
      lotSuffix: "A",
      displayLotNumber: "0001A",
      description: "",
      quantity: 1,
      status: "sold",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const b: Lot = {
      id: 2,
      eventId: 1,
      baseLotNumber: 1,
      lotSuffix: "",
      displayLotNumber: "0001",
      description: "",
      quantity: 1,
      status: "sold",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    expect(compareLotsForReport(b, a)).toBeLessThan(0);
  });
});

describe("buildPaymentMethodBreakdown", () => {
  it("groups paid invoices", () => {
    const invoices: Invoice[] = [
      {
        id: 1,
        eventId: 1,
        bidderId: 1,
        invoiceNumber: "1-001",
        subtotal: 100,
        taxAmount: 0,
        total: 100,
        status: "paid",
        paymentMethod: "cash",
        generatedAt: new Date(),
      },
      {
        id: 2,
        eventId: 1,
        bidderId: 2,
        invoiceNumber: "1-002",
        subtotal: 50,
        taxAmount: 0,
        total: 50,
        status: "paid",
        paymentMethod: "check",
        generatedAt: new Date(),
      },
    ];
    const rows = buildPaymentMethodBreakdown(invoices);
    expect(rows).toHaveLength(2);
    const cash = rows.find((r) => r.key === "cash");
    expect(cash?.count).toBe(1);
    expect(cash?.total).toBe(100);
  });
});
