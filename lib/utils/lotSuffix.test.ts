import { describe, expect, it } from "vitest";
import {
  displayLotNumberFromParts,
  maxLotSuffix,
  nextSuffix,
  suffixRank,
} from "./lotSuffix";

describe("nextSuffix", () => {
  it("empty to A", () => {
    expect(nextSuffix("")).toBe("A");
  });
  it("A to B", () => {
    expect(nextSuffix("A")).toBe("B");
  });
  it("Z to AA", () => {
    expect(nextSuffix("Z")).toBe("AA");
  });
  it("AZ to BA", () => {
    expect(nextSuffix("AZ")).toBe("BA");
  });
  it("ZZ to AAA", () => {
    expect(nextSuffix("ZZ")).toBe("AAA");
  });
});

describe("suffixRank / maxLotSuffix", () => {
  it("ranks suffixes", () => {
    expect(suffixRank("")).toBe(0);
    expect(suffixRank("A")).toBe(1);
    expect(suffixRank("Z")).toBe(26);
    expect(suffixRank("AA")).toBe(27);
  });
  it("maxLotSuffix", () => {
    expect(maxLotSuffix(["", "A", "B"])).toBe("B");
    expect(maxLotSuffix(["Z", "AA"])).toBe("AA");
  });
});

describe("displayLotNumberFromParts", () => {
  it("pads base and appends suffix", () => {
    expect(displayLotNumberFromParts(1, "")).toBe("0001");
    expect(displayLotNumberFromParts(1, "A")).toBe("0001A");
    expect(displayLotNumberFromParts(42, "BC")).toBe("0042BC");
  });
});
