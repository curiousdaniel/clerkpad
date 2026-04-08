import { describe, expect, it } from "vitest";
import {
  isServerSnapshotNewerThanLocalPull,
  shouldBlockAutoSnapshotReplace,
} from "@/lib/services/cloudSync";

describe("isServerSnapshotNewerThanLocalPull", () => {
  it("returns false for invalid server time", () => {
    expect(
      isServerSnapshotNewerThanLocalPull("not-a-date", undefined)
    ).toBe(false);
  });

  it("returns true when local never pulled", () => {
    expect(
      isServerSnapshotNewerThanLocalPull("2026-01-01T12:00:00.000Z", undefined)
    ).toBe(true);
  });

  it("returns true only when server is strictly newer", () => {
    const local = new Date("2026-01-01T12:00:00.000Z");
    expect(
      isServerSnapshotNewerThanLocalPull("2026-01-01T11:59:59.999Z", local)
    ).toBe(false);
    expect(
      isServerSnapshotNewerThanLocalPull("2026-01-01T12:00:00.000Z", local)
    ).toBe(false);
    expect(
      isServerSnapshotNewerThanLocalPull("2026-01-01T12:00:00.001Z", local)
    ).toBe(true);
  });
});

describe("shouldBlockAutoSnapshotReplace", () => {
  it("blocks when op sync is on and outbox has rows", () => {
    expect(shouldBlockAutoSnapshotReplace(true, 1)).toBe(true);
    expect(shouldBlockAutoSnapshotReplace(true, 3)).toBe(true);
  });

  it("allows when op sync is off", () => {
    expect(shouldBlockAutoSnapshotReplace(false, 99)).toBe(false);
  });

  it("allows when outbox is empty", () => {
    expect(shouldBlockAutoSnapshotReplace(true, 0)).toBe(false);
  });
});
