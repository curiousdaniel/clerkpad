import type { AuctionDB } from "@/lib/db";
import { ensureSettingsRow } from "@/lib/settings";
import {
  buildEventExport,
  importEventFromPayload,
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

/**
 * Import every cloud snapshot whose syncId is not already present locally.
 * Used so a second device/browser can hydrate from the server after login.
 * Pass the result of `fetchSyncList()` (when `ok`) so the list is not fetched twice.
 */
export async function pullCloudEventsMissingLocally(
  db: AuctionDB,
  listEntries: SyncListEntry[]
): Promise<{
  imported: number;
  alreadyLocal: number;
  fetchFailures: number;
}> {
  let imported = 0;
  let alreadyLocal = 0;
  let fetchFailures = 0;
  let latestPullAt: Date | null = null;

  for (const entry of listEntries) {
    const existing = await db.events
      .where("syncId")
      .equals(entry.eventSyncId)
      .first();
    if (existing) {
      alreadyLocal += 1;
      continue;
    }

    const snap = await fetchEventSnapshot(entry.eventSyncId);
    if (!snap.ok) {
      fetchFailures += 1;
      continue;
    }

    const summary = await importEventFromPayload(db, snap.payload);
    const serverTime = new Date(snap.updatedAt);
    await db.events.update(summary.eventId, {
      lastCloudPullAt: serverTime,
      updatedAt: new Date(),
    });
    latestPullAt = serverTime;
    imported += 1;
  }

  if (latestPullAt != null) {
    await ensureSettingsRow(db);
    await db.settings.update(1, { lastCloudPullAt: latestPullAt });
  }

  return { imported, alreadyLocal, fetchFailures };
}

export type PushAllSummary = {
  okCount: number;
  conflictCount: number;
  failCount: number;
  /** True if any failure was HTTP 503 (cloud tables / not configured). */
  serverUnavailable: boolean;
  /** Latest server updatedAt from any successful push, for UI. */
  lastUpdatedAt: string | null;
};

/**
 * Push a snapshot for every local event. Continues on per-event failure.
 * On 409 conflict, skips that event (caller may run restore for current event separately).
 */
export async function pushAllLocalEvents(
  db: AuctionDB,
  options?: { force?: boolean }
): Promise<PushAllSummary> {
  const rows = await db.events.toArray();
  let okCount = 0;
  let conflictCount = 0;
  let failCount = 0;
  let serverUnavailable = false;
  let lastUpdatedAt: string | null = null;

  for (const ev of rows) {
    const id = ev.id;
    if (id == null) continue;

    const result = await pushCurrentEvent(db, id, options);
    if (result.ok) {
      okCount += 1;
      await recordSuccessfulPush(db, id, result.updatedAt);
      lastUpdatedAt = result.updatedAt;
    } else if (result.conflict) {
      conflictCount += 1;
    } else {
      failCount += 1;
      if (result.status === 503) serverUnavailable = true;
    }
  }

  return {
    okCount,
    conflictCount,
    failCount,
    serverUnavailable,
    lastUpdatedAt,
  };
}
