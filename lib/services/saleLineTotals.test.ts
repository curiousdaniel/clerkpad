import { describe, expect, it } from "vitest";
import {
  saleLineHammerTotal,
  saleLineQuantity,
  saleUnitHammer,
} from "./saleLineTotals";

describe("saleLineQuantity", () => {
  it("defaults invalid to 1", () => {
    expect(saleLineQuantity({ quantity: 0 })).toBe(1);
    expect(saleLineQuantity({ quantity: NaN })).toBe(1);
  });

  it("floors decimals", () => {
    expect(saleLineQuantity({ quantity: 2.9 })).toBe(2);
  });
});

describe("saleUnitHammer / saleLineHammerTotal", () => {
  it("splits line total by quantity", () => {
    expect(saleUnitHammer({ amount: 300, quantity: 3 })).toBe(100);
    expect(saleLineHammerTotal({ amount: 300 })).toBe(300);
  });
});
