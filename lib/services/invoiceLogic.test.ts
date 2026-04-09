import { describe, expect, it } from "vitest";
import type { AuctionEvent, Invoice } from "@/lib/db";
import {
  computeInvoiceFromSubtotal,
  computeInvoiceTotalsFromParts,
  effectiveInvoiceBuyersPremiumRate,
  effectiveInvoiceTaxRate,
  formatInvoiceNumber,
  roundMoney,
} from "./invoiceLogic";

describe("roundMoney", () => {
  it("rounds to 2 decimals", () => {
    expect(roundMoney(10.005)).toBe(10.01);
    expect(roundMoney(10.004)).toBe(10);
  });
});

describe("computeInvoiceFromSubtotal", () => {
  it("applies tax", () => {
    const r = computeInvoiceFromSubtotal(100, 0.0875);
    expect(r.subtotal).toBe(100);
    expect(r.taxAmount).toBe(8.75);
    expect(r.total).toBe(108.75);
  });

  it("matches hammer aggregate with buyer’s premium before tax", () => {
    const hammerSubtotal = roundMoney(100 + 50);
    const bpRate = 0.1;
    const taxableSubtotal = roundMoney(hammerSubtotal * (1 + bpRate));
    expect(taxableSubtotal).toBe(165);
    const inv = computeInvoiceFromSubtotal(taxableSubtotal, 0.1);
    expect(inv.taxAmount).toBe(16.5);
    expect(inv.total).toBe(181.5);
  });
});

describe("formatInvoiceNumber", () => {
  it("pads sequence", () => {
    expect(formatInvoiceNumber(1, 1)).toBe("1-001");
    expect(formatInvoiceNumber(12, 42)).toBe("12-042");
  });
});

const baseEvent: AuctionEvent = {
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

describe("computeInvoiceTotalsFromParts", () => {
  it("applies BP only to hammer; manual lines after BP, before tax", () => {
    const inv = {} as Invoice;
    const r = computeInvoiceTotalsFromParts(
      100,
      [{ id: "a", description: "Fee", amount: 10 }],
      inv,
      baseEvent
    );
    expect(r.subtotal).toBe(100);
    expect(r.buyersPremiumAmount).toBe(10);
    expect(r.taxAmount).toBe(12);
    expect(r.total).toBe(132);
  });

  it("supports negative manual lines and invoice rate overrides", () => {
    const inv = {
      buyersPremiumRate: 0.2,
      taxRate: 0.05,
    } as Invoice;
    const r = computeInvoiceTotalsFromParts(
      100,
      [{ id: "a", description: "Credit", amount: -15 }],
      inv,
      baseEvent
    );
    expect(r.buyersPremiumAmount).toBe(20);
    expect(roundMoney(100 + 20 - 15)).toBe(105);
    expect(r.taxAmount).toBe(5.25);
    expect(r.total).toBe(110.25);
  });
});

describe("effective invoice rates", () => {
  it("falls back to event when invoice override unset", () => {
    const inv = {} as Invoice;
    expect(effectiveInvoiceBuyersPremiumRate(inv, baseEvent)).toBe(0.1);
    expect(effectiveInvoiceTaxRate(inv, baseEvent)).toBe(0.1);
  });

  it("uses invoice numbers when set", () => {
    const inv = { buyersPremiumRate: 0.15, taxRate: 0.08 } as Invoice;
    expect(effectiveInvoiceBuyersPremiumRate(inv, baseEvent)).toBe(0.15);
    expect(effectiveInvoiceTaxRate(inv, baseEvent)).toBe(0.08);
  });

  it("coerces string overrides and whole percents in (1, 100]", () => {
    const inv = {
      buyersPremiumRate: "10" as unknown as number,
      taxRate: "8.75" as unknown as number,
    } as Invoice;
    expect(effectiveInvoiceBuyersPremiumRate(inv, baseEvent)).toBe(0.1);
    expect(effectiveInvoiceTaxRate(inv, baseEvent)).toBe(0.0875);
  });
});
