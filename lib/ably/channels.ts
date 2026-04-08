/** Super-admin global in-app announcements (subscribe-only for clients). */
export const GLOBAL_ANNOUNCE_CHANNEL = "clerkbid:announce";

/** Ably channel for one event within a vendor (no secrets in the name). */
export function eventSyncChannelName(
  vendorId: number,
  eventSyncId: string
): string {
  return `vendor:${vendorId}:event:${eventSyncId.trim()}`;
}

/** Token capability: subscribe only, all events for this vendor. */
export function vendorEventSubscribeCapability(
  vendorId: number
): Record<string, string[]> {
  return {
    [`vendor:${vendorId}:event:*`]: ["subscribe"],
  };
}

/**
 * Full client subscribe capability: per-vendor event sync + global announcements.
 */
export function ablyClientSubscribeCapability(
  vendorId: number
): Record<string, string[]> {
  return {
    ...vendorEventSubscribeCapability(vendorId),
    [GLOBAL_ANNOUNCE_CHANNEL]: ["subscribe"],
  };
}
