/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_SALE_FIELD_ORDER,
  DEFAULT_SALE_FIELD_REQUIRED,
  coerceRequiredAfterToggle,
  enforceLotDescriptionInvariant,
  isNarrowSaleField,
  isValidSaleFieldOrder,
  normalizeSaleFieldOrder,
  normalizeSaleFormPrefs,
  normalizeSaleFieldRequired,
  readSaleFieldOrder,
  readSaleFormPrefs,
  writeSaleFieldOrder,
  writeSaleFormPrefs,
} from "./saleFormOrder";

describe("isNarrowSaleField", () => {
  it("is true for compact inputs", () => {
    expect(isNarrowSaleField("lot")).toBe(true);
    expect(isNarrowSaleField("price")).toBe(true);
    expect(isNarrowSaleField("paddle")).toBe(true);
    expect(isNarrowSaleField("quantity")).toBe(true);
    expect(isNarrowSaleField("consignor")).toBe(true);
    expect(isNarrowSaleField("initials")).toBe(true);
  });

  it("is false for full-width fields", () => {
    expect(isNarrowSaleField("description")).toBe(false);
    expect(isNarrowSaleField("notes")).toBe(false);
  });
});

describe("isValidSaleFieldOrder", () => {
  it("accepts default permutation", () => {
    expect(isValidSaleFieldOrder(DEFAULT_SALE_FIELD_ORDER)).toBe(true);
  });

  it("accepts another valid permutation", () => {
    const reversed = [...DEFAULT_SALE_FIELD_ORDER].reverse();
    expect(isValidSaleFieldOrder(reversed)).toBe(true);
  });

  it("rejects wrong length", () => {
    expect(isValidSaleFieldOrder(["lot", "price"])).toBe(false);
    expect(isValidSaleFieldOrder([])).toBe(false);
  });

  it("rejects duplicate", () => {
    const dup = [...DEFAULT_SALE_FIELD_ORDER];
    dup[7] = "lot";
    expect(isValidSaleFieldOrder(dup)).toBe(false);
  });

  it("rejects unknown id", () => {
    const bad = [...DEFAULT_SALE_FIELD_ORDER];
    (bad as string[])[0] = "nope";
    expect(isValidSaleFieldOrder(bad)).toBe(false);
  });
});

describe("normalizeSaleFieldOrder", () => {
  it("returns default for invalid input", () => {
    expect(normalizeSaleFieldOrder(null)).toEqual(DEFAULT_SALE_FIELD_ORDER);
    expect(normalizeSaleFieldOrder("x")).toEqual(DEFAULT_SALE_FIELD_ORDER);
    expect(normalizeSaleFieldOrder([1, 2, 3])).toEqual(
      DEFAULT_SALE_FIELD_ORDER
    );
  });

  it("returns copy of valid array", () => {
    const swapped = [...DEFAULT_SALE_FIELD_ORDER];
    const a = swapped[0]!;
    const b = swapped[1]!;
    swapped[0] = b;
    swapped[1] = a;
    const out = normalizeSaleFieldOrder(swapped);
    expect(out).toEqual(swapped);
    expect(out).not.toBe(swapped);
  });
});

describe("normalizeSaleFieldRequired", () => {
  it("fills defaults for empty input", () => {
    const r = normalizeSaleFieldRequired(null);
    expect(r).toEqual(DEFAULT_SALE_FIELD_REQUIRED);
    expect(r.paddle).toBe(true);
  });

  it("merges partial object", () => {
    const r = normalizeSaleFieldRequired({ lot: false, notes: true });
    expect(r.lot).toBe(false);
    expect(r.notes).toBe(true);
    expect(r.description).toBe(true);
    expect(r.paddle).toBe(true);
  });

  it("forces lot+description invariant when both false", () => {
    const r = normalizeSaleFieldRequired({ lot: false, description: false });
    expect(r.lot || r.description).toBe(true);
    expect(r.description).toBe(true);
  });

  it("keeps paddle true when false passed", () => {
    const r = normalizeSaleFieldRequired({ paddle: false });
    expect(r.paddle).toBe(true);
  });
});

describe("coerceRequiredAfterToggle", () => {
  const base = { ...DEFAULT_SALE_FIELD_REQUIRED };

  it("unchecking lot forces description on", () => {
    const next = coerceRequiredAfterToggle("lot", false, {
      ...base,
      description: false,
    });
    expect(next.lot).toBe(false);
    expect(next.description).toBe(true);
  });

  it("unchecking description forces lot on", () => {
    const next = coerceRequiredAfterToggle("description", false, {
      ...base,
      lot: false,
    });
    expect(next.description).toBe(false);
    expect(next.lot).toBe(true);
  });
});

describe("enforceLotDescriptionInvariant", () => {
  it("sets description when both false", () => {
    const r = { ...DEFAULT_SALE_FIELD_REQUIRED, lot: false, description: false };
    enforceLotDescriptionInvariant(r);
    expect(r.description).toBe(true);
  });
});

describe("normalizeSaleFormPrefs", () => {
  it("accepts legacy array", () => {
    const swapped = [...DEFAULT_SALE_FIELD_ORDER];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    const p = normalizeSaleFormPrefs(swapped);
    expect(p.order).toEqual(swapped);
    expect(p.required).toEqual(DEFAULT_SALE_FIELD_REQUIRED);
  });

  it("accepts v2 object", () => {
    const p = normalizeSaleFormPrefs({
      order: DEFAULT_SALE_FIELD_ORDER,
      required: { ...DEFAULT_SALE_FIELD_REQUIRED, notes: true },
    });
    expect(p.required.notes).toBe(true);
  });

  it("falls back for invalid v2 order", () => {
    const p = normalizeSaleFormPrefs({
      order: ["lot"],
      required: {},
    });
    expect(p.order).toEqual(DEFAULT_SALE_FIELD_ORDER);
  });
});

describe("readSaleFormPrefs / writeSaleFormPrefs", () => {
  it("read returns defaults when empty", () => {
    localStorage.clear();
    const p = readSaleFormPrefs();
    expect(p.order).toEqual(DEFAULT_SALE_FIELD_ORDER);
    expect(p.required).toEqual(DEFAULT_SALE_FIELD_REQUIRED);
  });

  it("round-trips v2 prefs", () => {
    const order = [...DEFAULT_SALE_FIELD_ORDER].reverse();
    const required = { ...DEFAULT_SALE_FIELD_REQUIRED, lot: false };
    writeSaleFormPrefs({ order, required });
    const p = readSaleFormPrefs();
    expect(p.order).toEqual(order);
    expect(p.required.lot).toBe(false);
    expect(p.required.description).toBe(true);
  });

  it("migrates legacy array in storage", () => {
    const swapped = [...DEFAULT_SALE_FIELD_ORDER];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    localStorage.setItem("clerkbid:saleFieldOrder", JSON.stringify(swapped));
    const p = readSaleFormPrefs();
    expect(p.order).toEqual(swapped);
    expect(p.required).toEqual(DEFAULT_SALE_FIELD_REQUIRED);
  });
});

describe("readSaleFieldOrder / writeSaleFieldOrder", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("read returns default when empty", () => {
    expect(readSaleFieldOrder()).toEqual(DEFAULT_SALE_FIELD_ORDER);
  });

  it("round-trips valid order and preserves required", () => {
    writeSaleFormPrefs({
      order: DEFAULT_SALE_FIELD_ORDER,
      required: { ...DEFAULT_SALE_FIELD_REQUIRED, initials: false },
    });
    const swapped = [...DEFAULT_SALE_FIELD_ORDER];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    writeSaleFieldOrder(swapped);
    expect(readSaleFieldOrder()).toEqual(swapped);
    expect(readSaleFormPrefs().required.initials).toBe(false);
  });

  it("read falls back on corrupt JSON in storage", () => {
    localStorage.setItem("clerkbid:saleFieldOrder", "not-json");
    expect(readSaleFieldOrder()).toEqual(DEFAULT_SALE_FIELD_ORDER);
  });
});
