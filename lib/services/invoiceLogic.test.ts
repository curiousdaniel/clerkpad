import { describe, expect, it } from "vitest";
import {
  computeInvoiceFromSubtotal,
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
});

describe("formatInvoiceNumber", () => {
  it("pads sequence", () => {
    expect(formatInvoiceNumber(1, 1)).toBe("1-001");
    expect(formatInvoiceNumber(12, 42)).toBe("12-042");
  });
});
