import { describe, expect, it } from "vitest";
import {
  ablyClientSubscribeCapability,
  eventSyncChannelName,
  GLOBAL_ANNOUNCE_CHANNEL,
  vendorEventSubscribeCapability,
} from "@/lib/ably/channels";

describe("eventSyncChannelName", () => {
  it("builds stable channel id", () => {
    expect(eventSyncChannelName(7, "550e8400-e29b-41d4-a716-446655440000")).toBe(
      "vendor:7:event:550e8400-e29b-41d4-a716-446655440000"
    );
  });

  it("trims sync id", () => {
    expect(eventSyncChannelName(1, "  abc  ")).toBe("vendor:1:event:abc");
  });
});

describe("vendorEventSubscribeCapability", () => {
  it("scopes wildcard to vendor", () => {
    expect(vendorEventSubscribeCapability(42)).toEqual({
      "vendor:42:event:*": ["subscribe"],
    });
  });
});

describe("ablyClientSubscribeCapability", () => {
  it("includes vendor events and global announce channel", () => {
    expect(ablyClientSubscribeCapability(42)).toEqual({
      "vendor:42:event:*": ["subscribe"],
      [GLOBAL_ANNOUNCE_CHANNEL]: ["subscribe"],
    });
  });
});
