import { describe, expect, it } from "vitest";
import type { Lot } from "@/lib/db";
import {
  compareLotsCatalogOrder,
  pickNextSuggestedLotDisplay,
} from "./nextBaseLot";

const now = new Date();

function mk(
  base: number,
  suffix: string,
  status: Lot["status"],
  display?: string
): Lot {
  return {
    eventId: 1,
    baseLotNumber: base,
    lotSuffix: suffix,
    displayLotNumber: display ?? String(base) + suffix,
    description: "",
    quantity: 1,
    status,
    createdAt: now,
    updatedAt: now,
  };
}

describe("compareLotsCatalogOrder", () => {
  it("orders by base then suffix", () => {
    const a = [mk(2, "", "unsold"), mk(10, "", "unsold"), mk(1, "B", "unsold")];
    const s = [...a].sort(compareLotsCatalogOrder);
    expect(s.map((l) => l.displayLotNumber)).toEqual(["1B", "2", "10"]);
  });
});

describe("pickNextSuggestedLotDisplay", () => {
  it("returns first unsold or passed when no after-sale hint", () => {
    const sorted = [
      mk(1, "", "sold"),
      mk(2, "", "unsold"),
      mk(3, "", "sold"),
      mk(5, "", "unsold"),
    ].sort(compareLotsCatalogOrder);
    expect(pickNextSuggestedLotDisplay(sorted, null)).toBe("2");
  });

  it("after selling lot 1 suggests 2, then 3, skipping sold 4 to 5", () => {
    const sorted = [
      mk(1, "", "sold"),
      mk(2, "", "unsold"),
      mk(3, "", "unsold"),
      mk(4, "", "sold"),
      mk(5, "", "unsold"),
    ].sort(compareLotsCatalogOrder);
    expect(pickNextSuggestedLotDisplay(sorted, "1")).toBe("2");

    const afterSelling2 = [
      mk(1, "", "sold"),
      mk(2, "", "sold"),
      mk(3, "", "unsold"),
      mk(4, "", "sold"),
      mk(5, "", "unsold"),
    ].sort(compareLotsCatalogOrder);
    expect(pickNextSuggestedLotDisplay(afterSelling2, "2")).toBe("3");

    const afterSelling3 = [
      mk(1, "", "sold"),
      mk(2, "", "sold"),
      mk(3, "", "sold"),
      mk(4, "", "sold"),
      mk(5, "", "unsold"),
    ].sort(compareLotsCatalogOrder);
    expect(pickNextSuggestedLotDisplay(afterSelling3, "3")).toBe("5");
  });

  it("returns null when no further catalog lots (use max+1)", () => {
    const sorted = [mk(1, "", "sold"), mk(2, "", "sold")].sort(
      compareLotsCatalogOrder
    );
    expect(pickNextSuggestedLotDisplay(sorted, "2")).toBeNull();
  });

  it("includes passed as a suggestion candidate", () => {
    const sorted = [mk(1, "", "sold"), mk(2, "", "passed")].sort(
      compareLotsCatalogOrder
    );
    expect(pickNextSuggestedLotDisplay(sorted, "1")).toBe("2");
  });
});
