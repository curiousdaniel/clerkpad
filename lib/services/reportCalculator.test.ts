import { describe, expect, it } from "vitest";
import {
  buildBidderReportRows,
  buildPaymentMethodBreakdown,
  compareLotsForReport,
  computeEventSummary,
} from "./reportCalculator";
import type { AuctionEvent, Bidder, Invoice, Lot, Sale } from "@/lib/db";

const reportEvent: AuctionEvent = {
  id: 1,
  name: "E",
  organizationName: "O",
  taxRate: 0.1,
  buyersPremiumRate: 0.1,
  defaultConsignorCommissionRate: 0,
  currencySymbol: "$",
  syncId: "x",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("computeEventSummary", () => {
  it("handles empty inputs", () => {
    const s = computeEventSummary([], [], [], []);
    expect(s.totalRevenue).toBe(0);
    expect(s.totalBuyersPremium).toBe(0);
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
        buyersPremiumAmount: 0,
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
        buyersPremiumAmount: 0,
        taxAmount: 4,
        total: 54,
        status: "unpaid",
        generatedAt: new Date(),
      },
    ];
    const s = computeEventSummary([], [], [], invoices);
    expect(s.totalTaxCollected).toBe(8);
    expect(s.totalBuyersPremium).toBe(0);
    expect(s.totalPaid).toBe(108);
    expect(s.totalOutstanding).toBe(54);
    expect(s.totalInvoiced).toBe(162);
  });

  it("sums buyer's premium across invoices", () => {
    const invoices: Invoice[] = [
      {
        id: 1,
        eventId: 1,
        bidderId: 1,
        invoiceNumber: "1-001",
        subtotal: 100,
        buyersPremiumAmount: 10,
        taxAmount: 11,
        total: 121,
        status: "paid",
        generatedAt: new Date(),
      },
      {
        id: 2,
        eventId: 1,
        bidderId: 2,
        invoiceNumber: "1-002",
        subtotal: 200,
        buyersPremiumAmount: 20,
        taxAmount: 22,
        total: 242,
        status: "unpaid",
        generatedAt: new Date(),
      },
    ];
    const s = computeEventSummary([], [], [], invoices);
    expect(s.totalBuyersPremium).toBe(30);
  });
});

describe("buildBidderReportRows", () => {
  it("marks Unpaid when all invoices are paid but a sale is unallocated", () => {
    const bidders: Bidder[] = [
      {
        id: 1,
        eventId: 1,
        paddleNumber: 1,
        firstName: "A",
        lastName: "B",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const sales: Sale[] = [
      {
        id: 10,
        eventId: 1,
        lotId: 1,
        bidderId: 1,
        displayLotNumber: "1",
        paddleNumber: 1,
        description: "x",
        quantity: 1,
        amount: 50,
        clerkInitials: "X",
        createdAt: new Date(),
        invoiceId: 100,
      },
      {
        id: 11,
        eventId: 1,
        lotId: 2,
        bidderId: 1,
        displayLotNumber: "2",
        paddleNumber: 1,
        description: "y",
        quantity: 1,
        amount: 25,
        clerkInitials: "X",
        createdAt: new Date(),
      },
    ];
    const invoices: Invoice[] = [
      {
        id: 100,
        eventId: 1,
        bidderId: 1,
        invoiceNumber: "1-001",
        subtotal: 50,
        buyersPremiumAmount: 0,
        taxAmount: 0,
        total: 50,
        status: "paid",
        generatedAt: new Date(),
      },
    ];
    const rows = buildBidderReportRows(bidders, sales, invoices, reportEvent);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.paymentStatus).toBe("Unpaid");
    expect(rows[0]!.buyersPremium).toBe(0);
    expect(rows[0]!.subtotal).toBe(75);
    expect(rows[0]!.tax).toBe(0);
    expect(rows[0]!.total).toBe(50);
  });

  it("uses invoice BP and tax when invoices exist", () => {
    const bidders: Bidder[] = [
      {
        id: 1,
        eventId: 1,
        paddleNumber: 1,
        firstName: "A",
        lastName: "B",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const sales: Sale[] = [
      {
        id: 10,
        eventId: 1,
        lotId: 1,
        bidderId: 1,
        displayLotNumber: "1",
        paddleNumber: 1,
        description: "x",
        quantity: 1,
        amount: 100,
        clerkInitials: "X",
        createdAt: new Date(),
        invoiceId: 100,
      },
    ];
    const invoices: Invoice[] = [
      {
        id: 100,
        eventId: 1,
        bidderId: 1,
        invoiceNumber: "1-001",
        subtotal: 100,
        buyersPremiumAmount: 10,
        taxAmount: 11,
        total: 121,
        status: "unpaid",
        generatedAt: new Date(),
      },
    ];
    const rows = buildBidderReportRows(bidders, sales, invoices, reportEvent);
    expect(rows[0]!.buyersPremium).toBe(10);
    expect(rows[0]!.tax).toBe(11);
    expect(rows[0]!.total).toBe(121);
  });

  it("applies event BP and tax when no invoice", () => {
    const bidders: Bidder[] = [
      {
        id: 1,
        eventId: 1,
        paddleNumber: 1,
        firstName: "A",
        lastName: "B",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
    const sales: Sale[] = [
      {
        id: 10,
        eventId: 1,
        lotId: 1,
        bidderId: 1,
        displayLotNumber: "1",
        paddleNumber: 1,
        description: "x",
        quantity: 1,
        amount: 100,
        clerkInitials: "X",
        createdAt: new Date(),
      },
    ];
    const rows = buildBidderReportRows(bidders, sales, [], reportEvent);
    expect(rows[0]!.subtotal).toBe(100);
    expect(rows[0]!.buyersPremium).toBe(10);
    expect(rows[0]!.tax).toBe(11);
    expect(rows[0]!.total).toBe(121);
    expect(rows[0]!.paymentStatus).toBe("No invoice");
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
        buyersPremiumAmount: 0,
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
        buyersPremiumAmount: 0,
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
