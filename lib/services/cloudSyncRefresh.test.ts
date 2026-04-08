import { describe, expect, it } from "vitest";
import {
  isServerSnapshotNewerThanLocalBaseline,
  shouldBlockAutoSnapshotReplace,
} from "@/lib/services/cloudSync";

describe("isServerSnapshotNewerThanLocalBaseline", () => {
  it("returns false for invalid server time", () => {
    expect(
      isServerSnapshotNewerThanLocalBaseline("not-a-date", undefined, undefined)
    ).toBe(false);
  });

  it("when lastCloudPullAt is set, compares only to that (strict newer)", () => {
    const pull = new Date("2026-01-01T12:00:00.000Z");
    expect(
      isServerSnapshotNewerThanLocalBaseline(
        "2026-01-01T11:59:59.999Z",
        pull,
        undefined
      )
    ).toBe(false);
    expect(
      isServerSnapshotNewerThanLocalBaseline(
        "2026-01-01T12:00:00.000Z",
        pull,
        undefined
      )
    ).toBe(false);
    expect(
      isServerSnapshotNewerThanLocalBaseline(
        "2026-01-01T12:00:00.001Z",
        pull,
        undefined
      )
    ).toBe(true);
  });

  it("when never pulled, uses lastCloudPushAt so equal server time is not newer", () => {
    const push = new Date("2026-01-01T12:00:00.000Z");
    expect(
      isServerSnapshotNewerThanLocalBaseline(
        "2026-01-01T12:00:00.000Z",
        undefined,
        push
      )
    ).toBe(false);
    expect(
      isServerSnapshotNewerThanLocalBaseline(
        "2026-01-01T12:00:00.001Z",
        undefined,
        push
      )
    ).toBe(true);
  });

  it("when neither pull nor push baseline, does not treat server as newer", () => {
    expect(
      isServerSnapshotNewerThanLocalBaseline(
        "2026-01-01T12:00:00.000Z",
        undefined,
        undefined
      )
    ).toBe(false);
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
