import type { AuctionDB } from "@/lib/db";
import { ensureSettingsRow } from "@/lib/settings";
import {
  buildEventExport,
  parseEventExportPayload,
  replaceEventFromPayload,
  type EventExportPayload,
} from "@/lib/services/dataPorter";

export type SyncListEntry = { eventSyncId: string; updatedAt: string };

export async function fetchSyncList(): Promise<
  { ok: true; events: SyncListEntry[] } | { ok: false; status: number }
> {
  const res = await fetch("/api/sync/list/", { credentials: "include" });
  if (!res.ok) return { ok: false, status: res.status };
  const data = (await res.json()) as { events: SyncListEntry[] };
  return { ok: true, events: data.events ?? [] };
}

export async function pushEventSnapshot(
  payload: EventExportPayload,
  options?: { force?: boolean }
): Promise<
  | { ok: true; updatedAt: string }
  | { ok: false; status: number; conflict?: boolean; serverUpdatedAt?: string }
> {
  const res = await fetch("/api/sync/push/", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventSyncId: payload.event.syncId,
      payload,
      clientExportedAt: payload.exportDate,
      force: options?.force === true,
    }),
  });
  if (res.status === 409) {
    const data = (await res.json()) as { serverUpdatedAt?: string };
    return {
      ok: false,
      status: 409,
      conflict: true,
      serverUpdatedAt: data.serverUpdatedAt,
    };
  }
  if (!res.ok) return { ok: false, status: res.status };
  const data = (await res.json()) as { updatedAt: string };
  return { ok: true, updatedAt: data.updatedAt };
}

export async function fetchEventSnapshot(syncId: string): Promise<
  | { ok: true; payload: EventExportPayload; updatedAt: string }
  | { ok: false; status: number }
> {
  const res = await fetch(
    `/api/sync/event/?syncId=${encodeURIComponent(syncId)}`,
    { credentials: "include" }
  );
  if (!res.ok) return { ok: false, status: res.status };
  const data = (await res.json()) as {
    payload: unknown;
    updatedAt: string;
  };
  try {
    const payload = parseEventExportPayload(data.payload);
    return { ok: true, payload, updatedAt: data.updatedAt };
  } catch {
    return { ok: false, status: 422 };
  }
}

export async function pushCurrentEvent(
  db: AuctionDB,
  eventId: number,
  options?: { force?: boolean }
): Promise<
  | { ok: true; updatedAt: string }
  | { ok: false; status: number; conflict?: boolean; serverUpdatedAt?: string }
> {
  const payload = await buildEventExport(db, eventId);
  if (!payload.event.syncId) {
    return { ok: false, status: 400 };
  }
  return pushEventSnapshot(payload, options);
}

export async function restoreEventFromCloud(
  db: AuctionDB,
  eventId: number,
  syncId: string
): Promise<
  { ok: true; updatedAt: string } | { ok: false; status: number }
> {
  const snap = await fetchEventSnapshot(syncId);
  if (!snap.ok) return { ok: false, status: snap.status };
  await replaceEventFromPayload(db, eventId, snap.payload);
  const serverTime = new Date(snap.updatedAt);
  await db.events.update(eventId, {
    lastCloudPullAt: serverTime,
    updatedAt: new Date(),
  });
  return { ok: true, updatedAt: snap.updatedAt };
}

export async function recordSuccessfulPush(
  db: AuctionDB,
  eventId: number,
  updatedAtIso: string
): Promise<void> {
  const t = new Date(updatedAtIso);
  await db.events.update(eventId, { lastCloudPushAt: t });
  await ensureSettingsRow(db);
  await db.settings.update(1, { lastCloudPushAt: t });
}
