import type { AuctionEvent, Consignor, Lot, Sale } from "@/lib/db";
import { parseConsignorNumberFromLabel, resolveConsignorForSale } from "@/lib/services/consignorAttribution";
import {
  effectiveCommissionRate,
  lineCommission,
} from "@/lib/services/consignorCommission";
import {
  buildConsignorReportRows,
  computeConsignorCommissionEventTotals,
} from "@/lib/services/reportCalculator";
import { describe, expect, it } from "vitest";

const baseEvent: AuctionEvent = {
  id: 1,
  name: "E",
  organizationName: "O",
  taxRate: 0,
  buyersPremiumRate: 0,
  defaultConsignorCommissionRate: 0.15,
  currencySymbol: "$",
  syncId: "x",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function consignor(partial: Partial<Consignor> & Pick<Consignor, "id" | "consignorNumber" | "name">): Consignor {
  const now = new Date();
  return {
    eventId: 1,
    email: undefined,
    phone: undefined,
    notes: undefined,
    commissionRate: undefined,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

describe("effectiveCommissionRate", () => {
  it("uses event default when consignor has no override", () => {
    expect(effectiveCommissionRate(baseEvent, consignor({ id: 1, consignorNumber: 1, name: "A" }))).toBe(0.15);
  });

  it("uses consignor override when set", () => {
    expect(
      effectiveCommissionRate(
        baseEvent,
        consignor({ id: 1, consignorNumber: 1, name: "A", commissionRate: 0.2 })
      )
    ).toBe(0.2);
  });

  it("clamps override to 0–1", () => {
    expect(
      effectiveCommissionRate(
        baseEvent,
        consignor({ id: 1, consignorNumber: 1, name: "A", commissionRate: 2 })
      )
    ).toBe(1);
  });

  it("parses string override as whole percent when in (1, 100]", () => {
    expect(
      effectiveCommissionRate(
        baseEvent,
        consignor({
          id: 1,
          consignorNumber: 1,
          name: "A",
          commissionRate: "20" as unknown as number,
        })
      )
    ).toBe(0.2);
  });
});

describe("lineCommission", () => {
  it("rounds cents", () => {
    expect(lineCommission(100, 0.155)).toBe(15.5);
  });
});

describe("parseConsignorNumberFromLabel", () => {
  it("parses hash prefix", () => {
    expect(parseConsignorNumberFromLabel("#12 — Jane")).toBe(12);
  });
  it("parses digits-only line", () => {
    expect(parseConsignorNumberFromLabel("  7  ")).toBe(7);
  });
});

describe("resolveConsignorForSale", () => {
  const c12 = consignor({ id: 10, consignorNumber: 12, name: "Jane Doe" });
  const list = [c12];

  it("prefers consignorId", () => {
    const sale = {
      eventId: 1,
      lotId: 1,
      bidderId: 1,
      displayLotNumber: "1",
      paddleNumber: 1,
      description: "",
      quantity: 1,
      amount: 50,
      clerkInitials: "",
      createdAt: new Date(),
      consignorId: 10,
      consignor: "noise",
    } satisfies Sale;
    expect(resolveConsignorForSale(sale, undefined, list)).toBe(c12);
  });

  it("matches by #N in label", () => {
    const sale = {
      eventId: 1,
      lotId: 1,
      bidderId: 1,
      displayLotNumber: "1",
      paddleNumber: 1,
      description: "",
      quantity: 1,
      amount: 50,
      clerkInitials: "",
      createdAt: new Date(),
      consignor: "#12 — Jane Doe",
    } satisfies Sale;
    expect(resolveConsignorForSale(sale, undefined, list)).toBe(c12);
  });

  it("returns null when ambiguous", () => {
    const a = consignor({ id: 1, consignorNumber: 1, name: "Same" });
    const b = consignor({ id: 2, consignorNumber: 2, name: "Same" });
    const sale = {
      eventId: 1,
      lotId: 1,
      bidderId: 1,
      displayLotNumber: "1",
      paddleNumber: 1,
      description: "",
      quantity: 1,
      amount: 50,
      clerkInitials: "",
      createdAt: new Date(),
      consignor: "Same",
    } satisfies Sale;
    expect(resolveConsignorForSale(sale, undefined, [a, b])).toBeNull();
  });
});

describe("buildConsignorReportRows", () => {
  it("aggregates hammer and commission with override", () => {
    const c = consignor({ id: 1, consignorNumber: 5, name: "VIP", commissionRate: 0.1 });
    const lot: Lot = {
      id: 100,
      eventId: 1,
      baseLotNumber: 1,
      lotSuffix: "",
      displayLotNumber: "1",
      description: "x",
      quantity: 1,
      status: "sold",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const sale: Sale = {
      eventId: 1,
      lotId: 100,
      bidderId: 1,
      displayLotNumber: "1",
      paddleNumber: 1,
      description: "x",
      quantity: 1,
      amount: 200,
      clerkInitials: "a",
      createdAt: new Date(),
      consignorId: 1,
    };
    const rows = buildConsignorReportRows(baseEvent, [c], [lot], [sale]);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.grossHammer).toBe(200);
    expect(rows[0]!.commission).toBe(20);
    expect(rows[0]!.netToConsignor).toBe(180);
    const totals = computeConsignorCommissionEventTotals(rows);
    expect(totals.totalCommission).toBe(20);
  });
});
