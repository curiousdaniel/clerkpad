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

const SYNC_SCOPE_RE = /^[a-z][a-z0-9_-]{0,31}$/i;

/** Sanitize optional client scope hint (table/area); omit if invalid. */
export function sanitizeSyncScope(scope: unknown): string | undefined {
  if (typeof scope !== "string") return undefined;
  const s = scope.trim();
  if (!s || !SYNC_SCOPE_RE.test(s)) return undefined;
  return s;
}

/**
 * Notify subscribed clients that this event’s cloud data may have changed.
 * Fire-and-forget; logs and ignores errors (sync still converges via polling).
 */
export function publishEventSyncNudge(
  vendorId: number,
  eventSyncId: string,
  extra?: { scope?: string }
): void {
  const r = getRest();
  if (!r) return;
  const name = eventSyncChannelName(vendorId, eventSyncId);
  const scope = sanitizeSyncScope(extra?.scope);
  const payload: { t: number; scope?: string } = { t: Date.now() };
  if (scope) payload.scope = scope;
  void r.channels
    .get(name)
    .publish("sync", payload)
    .catch((err: unknown) => {
      console.error("[ably] publish failed", name, err);
    });
}
