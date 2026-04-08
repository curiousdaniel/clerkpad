import type { AuctionDB } from "@/lib/db";
import { ensureSettingsRow } from "@/lib/settings";
import {
  buildEventExport,
  importEventFromPayload,
  parseEventExportPayload,
  replaceEventFromPayload,
  type EventExportPayload,
} from "@/lib/services/dataPorter";
import { isSyncOpsEnabled } from "@/lib/sync/syncOpsFlag";

export type SyncListEntry = { eventSyncId: string; updatedAt: string };

/**
 * True when the server snapshot is strictly newer than our local merge baseline.
 * Uses `lastCloudPullAt` when set (normal case). If we never pulled, uses
 * `lastCloudPushAt` so we do not replace local Dexie with an older server copy
 * right after adding rows (push is still debounced). If both are missing, false.
 */
export function isServerSnapshotNewerThanLocalBaseline(
  serverUpdatedAtIso: string,
  localLastCloudPullAt: Date | undefined,
  localLastCloudPushAt: Date | undefined
): boolean {
  const serverMs = new Date(serverUpdatedAtIso).getTime();
  if (!Number.isFinite(serverMs)) return false;
  if (localLastCloudPullAt != null) {
    return serverMs > localLastCloudPullAt.getTime();
  }
  if (localLastCloudPushAt != null) {
    return serverMs > localLastCloudPushAt.getTime();
  }
  return false;
}

/** Op-sync outbox rows must not be dropped by a full snapshot replace. */
export function shouldBlockAutoSnapshotReplace(
  syncOpsEnabled: boolean,
  pendingOutboxCount: number
): boolean {
  return syncOpsEnabled && pendingOutboxCount > 0;
}

async function canAutoReplaceSnapshotForEvent(
  db: AuctionDB,
  eventSyncId: string
): Promise<boolean> {
  const pending = await db.syncOutbox
    .where("eventSyncId")
    .equals(eventSyncId)
    .count();
  return !shouldBlockAutoSnapshotReplace(isSyncOpsEnabled(), pending);
}

export type RefreshEventFromCloudResult =
  | { refreshed: true }
  | {
      refreshed: false;
      reason:
        | "no_event"
        | "no_sync_id"
        | "outbox_pending"
        | "fetch_failed"
        | "not_newer";
    };

/**
 * If the server snapshot is newer than our baseline (`lastCloudPullAt`, else
 * `lastCloudPushAt`), replace local event data from the cloud (bidders, lots, sales, etc.).
 * Skips when op-sync is on and this event has pending outbox rows (would lose ops).
 */
export async function refreshEventFromCloudIfServerNewer(
  db: AuctionDB,
  eventId: number
): Promise<RefreshEventFromCloudResult> {
  const ev = await db.events.get(eventId);
  if (ev?.id == null) return { refreshed: false, reason: "no_event" };
  const syncId = ev.syncId?.trim();
  if (!syncId) return { refreshed: false, reason: "no_sync_id" };
  if (!(await canAutoReplaceSnapshotForEvent(db, syncId))) {
    return { refreshed: false, reason: "outbox_pending" };
  }
  const snap = await fetchEventSnapshot(syncId);
  if (!snap.ok) return { refreshed: false, reason: "fetch_failed" };
  if (
    !isServerSnapshotNewerThanLocalBaseline(
      snap.updatedAt,
      ev.lastCloudPullAt,
      ev.lastCloudPushAt
    )
  ) {
    return { refreshed: false, reason: "not_newer" };
  }
  await replaceEventFromPayload(db, eventId, snap.payload);
  const serverTime = new Date(snap.updatedAt);
  await db.events.update(eventId, {
    lastCloudPullAt: serverTime,
    updatedAt: new Date(),
  });
  return { refreshed: true };
}

/**
 * For each cloud list entry that matches a local event, pull the snapshot when the server
 * copy is newer than `lastCloudPullAt`. Used after sync list fetch (throttled interval).
 */
export async function refreshStaleLocalEventsFromList(
  db: AuctionDB,
  listEntries: SyncListEntry[]
): Promise<{ refreshed: number; skipped: number; latestPullAt: Date | null }> {
  let refreshed = 0;
  let skipped = 0;
  let latestPullAt: Date | null = null;

  for (const entry of listEntries) {
    const local = await db.events
      .where("syncId")
      .equals(entry.eventSyncId)
      .first();
    if (local?.id == null) {
      skipped += 1;
      continue;
    }
    if (
      !isServerSnapshotNewerThanLocalBaseline(
        entry.updatedAt,
        local.lastCloudPullAt,
        local.lastCloudPushAt
      )
    ) {
      skipped += 1;
      continue;
    }
    if (!(await canAutoReplaceSnapshotForEvent(db, entry.eventSyncId))) {
      skipped += 1;
      continue;
    }
    const snap = await fetchEventSnapshot(entry.eventSyncId);
    if (!snap.ok) {
      skipped += 1;
      continue;
    }
    if (
      !isServerSnapshotNewerThanLocalBaseline(
        snap.updatedAt,
        local.lastCloudPullAt,
        local.lastCloudPushAt
      )
    ) {
      skipped += 1;
      continue;
    }
    await replaceEventFromPayload(db, local.id, snap.payload);
    const serverTime = new Date(snap.updatedAt);
    await db.events.update(local.id, {
      lastCloudPullAt: serverTime,
      updatedAt: new Date(),
    });
    refreshed += 1;
    if (
      latestPullAt == null ||
      serverTime.getTime() > latestPullAt.getTime()
    ) {
      latestPullAt = serverTime;
    }
  }

  if (latestPullAt != null) {
    await ensureSettingsRow(db);
    await db.settings.update(1, { lastCloudPullAt: latestPullAt });
  }

  return { refreshed, skipped, latestPullAt };
}

export async function fetchSyncList(): Promise<
  { ok: true; events: SyncListEntry[] } | { ok: false; status: number }
> {
  const res = await fetch("/api/sync/list/", {
    credentials: "include",
    cache: "no-store",
  });
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
    cache: "no-store",
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
    { credentials: "include", cache: "no-store" }
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

export type SnapshotPushConflict = {
  eventId: number;
  serverUpdatedAt?: string;
};

export type PushAllSummary = {
  okCount: number;
  conflictCount: number;
  failCount: number;
  /** True if any failure was HTTP 503 (cloud tables / not configured). */
  serverUnavailable: boolean;
  /** Latest server updatedAt from any successful push, for UI. */
  lastUpdatedAt: string | null;
  /** Snapshot 409s by local event id (for UI: real save conflicts only). */
  snapshotConflicts: SnapshotPushConflict[];
  /** Event ids that successfully snapshot-pushed in this batch. */
  snapshotPushedOkEventIds: number[];
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
  const snapshotConflicts: SnapshotPushConflict[] = [];
  const snapshotPushedOkEventIds: number[] = [];

  for (const ev of rows) {
    const id = ev.id;
    if (id == null) continue;

    const result = await pushCurrentEvent(db, id, options);
    if (result.ok) {
      okCount += 1;
      await recordSuccessfulPush(db, id, result.updatedAt);
      lastUpdatedAt = result.updatedAt;
      snapshotPushedOkEventIds.push(id);
    } else if (result.conflict) {
      conflictCount += 1;
      snapshotConflicts.push({
        eventId: id,
        serverUpdatedAt: result.serverUpdatedAt,
      });
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
    snapshotConflicts,
    snapshotPushedOkEventIds,
  };
}
