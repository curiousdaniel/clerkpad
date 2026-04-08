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
