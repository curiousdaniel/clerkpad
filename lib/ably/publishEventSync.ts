import Ably from "ably";
import { eventSyncChannelName } from "@/lib/ably/channels";

let rest: Ably.Rest | null = null;

function getRest(): Ably.Rest | null {
  const key = process.env.ABLY_API_KEY?.trim();
  if (!key) return null;
  if (!rest) {
    rest = new Ably.Rest({ key });
  }
  return rest;
}

/**
 * Notify subscribed clients that this event’s cloud data may have changed.
 * Fire-and-forget; logs and ignores errors (sync still converges via polling).
 */
export function publishEventSyncNudge(
  vendorId: number,
  eventSyncId: string
): void {
  const r = getRest();
  if (!r) return;
  const name = eventSyncChannelName(vendorId, eventSyncId);
  void r.channels
    .get(name)
    .publish("sync", { t: Date.now() })
    .catch((err: unknown) => {
      console.error("[ably] publish failed", name, err);
    });
}
