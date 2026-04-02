/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import {
  DEFAULT_SALE_FIELD_ORDER,
  isValidSaleFieldOrder,
  normalizeSaleFieldOrder,
  readSaleFieldOrder,
  writeSaleFieldOrder,
} from "./saleFormOrder";

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

describe("readSaleFieldOrder / writeSaleFieldOrder", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("read returns default when empty", () => {
    expect(readSaleFieldOrder()).toEqual(DEFAULT_SALE_FIELD_ORDER);
  });

  it("round-trips valid order", () => {
    const swapped = [...DEFAULT_SALE_FIELD_ORDER];
    [swapped[0], swapped[1]] = [swapped[1]!, swapped[0]!];
    writeSaleFieldOrder(swapped);
    expect(readSaleFieldOrder()).toEqual(swapped);
  });

  it("read falls back on corrupt JSON in storage", () => {
    localStorage.setItem("clerkbid:saleFieldOrder", "not-json");
    expect(readSaleFieldOrder()).toEqual(DEFAULT_SALE_FIELD_ORDER);
  });
});
