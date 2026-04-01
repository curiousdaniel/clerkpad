import { describe, expect, it } from "vitest";
import { formatBaseLotDisplay, parseLotDisplay } from "./lotParse";

describe("parseLotDisplay", () => {
  it("parses padded base", () => {
    expect(parseLotDisplay("0001")).toEqual({ base: 1, suffix: "" });
  });
  it("parses unpadded base", () => {
    expect(parseLotDisplay("42")).toEqual({ base: 42, suffix: "" });
  });
  it("parses suffix", () => {
    expect(parseLotDisplay("0001a")).toEqual({ base: 1, suffix: "A" });
    expect(parseLotDisplay("12AB")).toEqual({ base: 12, suffix: "AB" });
  });
  it("rejects invalid", () => {
    expect(parseLotDisplay("")).toBeNull();
    expect(parseLotDisplay("ABC")).toBeNull();
    expect(parseLotDisplay("12345")).toBeNull();
  });
});

describe("formatBaseLotDisplay", () => {
  it("pads to 4", () => {
    expect(formatBaseLotDisplay(1)).toBe("0001");
    expect(formatBaseLotDisplay(9999)).toBe("9999");
  });
});
