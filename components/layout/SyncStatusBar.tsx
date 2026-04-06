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

/** Compact cloud sync status in the header; hover or focus for details. */
export function SyncStatusIndicator() {
  const {
    online,
    syncPhase,
    lastPushAt,
    lastPullAt,
    lastSyncError,
    cloudSyncAvailable,
  } = useCloudSync();

  const busy = syncPhase === "pushing" || syncPhase === "pulling";

  let dotClass =
    "bg-emerald-500 shadow-[0_0_0_1px_rgba(255,255,255,0.4)] dark:shadow-[0_0_0_1px_rgba(0,0,0,0.35)]";
  let label = "Cloud sync: connected";

  if (!cloudSyncAvailable) {
    dotClass = "bg-amber-500";
    label = "Cloud backup not available on this server";
  } else if (!online) {
    dotClass = "bg-rose-500";
    label = "Cloud sync paused — you are offline";
  } else if (busy) {
    dotClass = "animate-pulse bg-sky-500";
    label = "Cloud sync in progress";
  } else if (lastSyncError) {
    dotClass = "bg-red-500";
    label = "Cloud sync error";
  }

  const tooltipId = "cloud-sync-status-tooltip";

  return (
    <div className="group relative flex items-center">
      <button
        type="button"
        className="flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-navy outline-none ring-navy/20 transition hover:bg-navy/5 focus-visible:ring-2 dark:text-slate-200 dark:hover:bg-slate-800 dark:ring-slate-500/40"
        aria-describedby={tooltipId}
        aria-label={label}
      >
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`}
          aria-hidden
        />
      </button>
      <div
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute right-0 top-full z-50 mt-1 w-max max-w-[min(22rem,calc(100vw-2rem))] translate-y-0 rounded-md border border-navy/15 bg-white p-3 text-left text-xs text-ink opacity-0 shadow-lg transition-opacity duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        {!cloudSyncAvailable ? (
          <p className="text-amber-900 dark:text-amber-200">
            Cloud backup is not available on this server (database not
            configured). Your data stays on this device only.
          </p>
        ) : !online ? (
          <p className="text-rose-900 dark:text-rose-200">
            You&apos;re offline — changes stay on this device only; cloud sync is
            paused. If teammates are online, their devices won&apos;t see your
            edits until you reconnect and sync. Two devices both offline can
            diverge; use Restore from cloud or Overwrite in Settings after
            reconnect if needed.
          </p>
        ) : (
          <div className="space-y-2 text-muted dark:text-slate-400">
            <p className="font-medium text-navy dark:text-slate-200">
              Cloud sync
              {busy ? (
                <span className="font-normal"> — Syncing with cloud…</span>
              ) : (
                <span className="font-normal"> — On · connected</span>
              )}
            </p>
            <p>
              Last backup to account:{" "}
              {lastPushAt == null ? (
                <span className="text-amber-800 dark:text-amber-200">
                  not from this device yet
                </span>
              ) : (
                formatRelative(lastPushAt)
              )}
            </p>
            <p>
              Checked cloud for other devices: {formatRelative(lastPullAt)}
            </p>
            {lastSyncError ? (
              <p className="text-danger dark:text-red-400">{lastSyncError}</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
