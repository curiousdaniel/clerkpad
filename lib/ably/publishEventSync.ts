import Ably from "ably";
import {
  eventSyncChannelName,
  GLOBAL_ANNOUNCE_CHANNEL,
} from "@/lib/ably/channels";

/** Payload published on `clerkbid:announce` / event `announce`. */
export type GlobalAnnouncePayload = {
  id: string;
  title?: string;
  body: string;
  severity: "info" | "warning";
  issuedAt: number;
  /** When true, clients should report toast delivery so login-time queue does not duplicate. */
  persistedForLogin?: boolean;
};

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
      // Best-effort only; HTTP sync still succeeded. Avoid console.error so Vercel
      // `level:error` is not flooded when Ably REST times out (e.g. cold start / network).
      console.warn("[ably] sync nudge publish failed (non-fatal)", name, err);
    });
}

export function publishGlobalAnnounce(payload: GlobalAnnouncePayload): void {
  const r = getRest();
  if (!r) return;
  void r.channels
    .get(GLOBAL_ANNOUNCE_CHANNEL)
    .publish("announce", payload)
    .catch((err: unknown) => {
      console.warn("[ably] global announce publish failed (non-fatal)", err);
    });
}
