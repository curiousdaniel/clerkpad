"use client";

import { useCloudSync } from "@/components/providers/CloudSyncProvider";

function formatRelative(d: Date | null): string {
  if (d == null) return "—";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function SyncStatusBar() {
  const {
    online,
    syncPhase,
    lastPushAt,
    lastPullAt,
    lastSyncError,
    cloudSyncAvailable,
  } = useCloudSync();

  if (!cloudSyncAvailable) {
    return (
      <div
        className="mx-auto max-w-6xl px-4 py-2 text-xs text-amber-900 dark:text-amber-200"
        role="status"
      >
        Cloud backup is not available on this server (database not configured).
        Your data stays on this device only.
      </div>
    );
  }

  if (!online) {
    return (
      <div
        className="mx-auto max-w-6xl px-4 py-2 text-xs text-rose-900 dark:text-rose-200"
        role="status"
      >
        You&apos;re offline — changes stay on this device only; cloud sync is
        paused. If teammates are online, their devices won&apos;t see your edits
        until you reconnect and sync. Two devices both offline can diverge; use
        Restore from cloud or Overwrite in Settings after reconnect if needed.
      </div>
    );
  }

  const busy = syncPhase === "pushing" || syncPhase === "pulling";

  return (
    <div
      className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-xs text-muted dark:text-slate-400"
      role="status"
    >
      <span className="font-medium text-navy dark:text-slate-200">Cloud sync</span>
      {busy ? (
        <span>Syncing with cloud…</span>
      ) : (
        <span>On · connected</span>
      )}
      <span className="text-muted dark:text-slate-500">
        Last backup to account:{" "}
        {lastPushAt == null ? (
          <span className="text-amber-800 dark:text-amber-200">
            not from this device yet
          </span>
        ) : (
          formatRelative(lastPushAt)
        )}
      </span>
      <span className="text-muted dark:text-slate-500">
        Checked cloud for other devices: {formatRelative(lastPullAt)}
      </span>
      {lastSyncError ? (
        <span className="text-danger dark:text-red-400">{lastSyncError}</span>
      ) : null}
    </div>
  );
}
