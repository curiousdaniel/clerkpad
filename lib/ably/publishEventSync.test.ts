import { describe, expect, it } from "vitest";
import { sanitizeSyncScope } from "./publishEventSync";

describe("sanitizeSyncScope", () => {
  it("accepts safe scope strings", () => {
    expect(sanitizeSyncScope("data")).toBe("data");
    expect(sanitizeSyncScope("bidders")).toBe("bidders");
    expect(sanitizeSyncScope("  sales  ")).toBe("sales");
  });

  it("rejects empty or invalid", () => {
    expect(sanitizeSyncScope("")).toBeUndefined();
    expect(sanitizeSyncScope("   ")).toBeUndefined();
    expect(sanitizeSyncScope("../x")).toBeUndefined();
    expect(sanitizeSyncScope("a".repeat(40))).toBeUndefined();
    expect(sanitizeSyncScope(1 as unknown as string)).toBeUndefined();
  });
});
