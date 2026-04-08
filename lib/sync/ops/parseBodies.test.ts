import { describe, expect, it } from "vitest";
import {
  parseInvoicePatchBody,
  parseInvoicePutBody,
  parseSaleDeleteBody,
  parseSalePutBody,
} from "@/lib/sync/ops/parseBodies";

describe("parseSalePutBody", () => {
  it("accepts minimal valid body", () => {
    const p = parseSalePutBody({
      saleSyncKey: "550e8400-e29b-41d4-a716-446655440000",
      displayLotNumber: "12",
      paddleNumber: 5,
      description: "Widget",
      quantity: 1,
      amount: 100,
      clerkInitials: "AB",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    expect(p).not.toBeNull();
    expect(p?.saleSyncKey).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("rejects invalid paddle", () => {
    expect(parseSalePutBody({})).toBeNull();
  });
});

describe("parseSaleDeleteBody", () => {
  it("parses", () => {
    expect(
      parseSaleDeleteBody({ saleSyncKey: "550e8400-e29b-41d4-a716-446655440000" })
    ).toEqual({
      saleSyncKey: "550e8400-e29b-41d4-a716-446655440000",
    });
  });
});

describe("parseInvoicePutBody", () => {
  it("accepts paid shape", () => {
    const p = parseInvoicePutBody({
      invoiceSyncKey: "550e8400-e29b-41d4-a716-446655440001",
      invoiceNumber: "1-001",
      paddleNumber: 3,
      status: "paid",
      subtotal: 10,
      buyersPremiumAmount: 1,
      taxAmount: 0.5,
      total: 11.5,
      generatedAt: "2024-01-01T00:00:00.000Z",
      paymentMethod: "cash",
    });
    expect(p).not.toBeNull();
    expect(p?.status).toBe("paid");
  });
});

describe("parseInvoicePatchBody", () => {
  it("accepts empty patch", () => {
    const p = parseInvoicePatchBody({
      invoiceSyncKey: "550e8400-e29b-41d4-a716-446655440002",
      patch: {},
      recalculate: true,
    });
    expect(p).not.toBeNull();
    expect(p?.recalculate).toBe(true);
  });
});
