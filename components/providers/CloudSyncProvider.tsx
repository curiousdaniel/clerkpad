"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useSession } from "next-auth/react";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { useEventContext } from "@/components/providers/EventProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { useUserDb } from "@/components/providers/UserDbProvider";
import {
  fetchSyncList,
  pushAllLocalEvents,
  pushCurrentEvent,
  pullCloudEventsMissingLocally,
  recordSuccessfulPush,
  restoreEventFromCloud,
} from "@/lib/services/cloudSync";
import {
  pushAllPendingOps,
  runOperationLevelSync,
} from "@/lib/services/opSyncClient";
import { isAblyRealtimeSyncEnabled } from "@/lib/ably/ablySyncFlag";
import { eventSyncChannelName } from "@/lib/ably/channels";
import { isSyncOpsEnabled } from "@/lib/sync/syncOpsFlag";
import Ably from "ably";
import { ensureSettingsRow } from "@/lib/settings";
import { dateGetTime } from "@/lib/utils/coerceDate";

/** Background pull uses this minimum gap between list fetches (see plan: ~30–60s). */
const PULL_LIST_THROTTLE_MS = 45_000;
/** Push all local events on this interval while online (plan: ~20–30s). */
const PUSH_ALL_INTERVAL_MS = 25_000;
/** How often to check if the server has a newer backup for the current event. */
const REMOTE_NEWER_CHECK_MS = 50_000;

type SyncPhase = "idle" | "pushing" | "pulling";

type PushResult = { ok: true } | { ok: false; message: string };

export type CloudSyncContextValue = {
  pushNow: (options?: { force?: boolean }) => Promise<boolean>;
  restoreFromCloud: () => Promise<boolean>;
  lastPushAt: Date | null;
  lastPullAt: Date | null;
  checking: boolean;
  online: boolean;
  syncPhase: SyncPhase;
  lastSyncError: string | null;
  /** False when the server reports cloud sync tables missing (503). */
  cloudSyncAvailable: boolean;
  /** Debounced upload after local changes (events, bidders, sales, etc.). */
  scheduleCloudPush: () => void;
  /**
   * Uploads all local events to the cloud. Returns true when safe to sign out
   * (no events, or every event saved successfully).
   */
  ensureCloudBackupBeforeSignOut: () => Promise<boolean>;
};

const CloudSyncContext = createContext<CloudSyncContextValue | null>(null);

export function useCloudSync(): CloudSyncContextValue {
  const ctx = useContext(CloudSyncContext);
  if (!ctx) {
    throw new Error("useCloudSync must be used within CloudSyncProvider");
  }
  return ctx;
}

export function CloudSyncProvider({ children }: { children: ReactNode }) {
  const { status, data: session } = useSession();
  const { db, ready: dbReady } = useUserDb();
  const { currentEventId, currentEvent, refresh, switchEvent } =
    useEventContext();
  const { showToast } = useToast();

  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [remoteBanner, setRemoteBanner] = useState<{
    serverUpdatedAt: string;
  } | null>(null);
  const [lastPushAt, setLastPushAt] = useState<Date | null>(null);
  const [lastPullAt, setLastPullAt] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);
  const [syncPhase, setSyncPhase] = useState<SyncPhase>("idle");
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [cloudSyncAvailable, setCloudSyncAvailable] = useState(true);

  /** Updated only after a successful `fetchSyncList` (so failed list calls can retry next cycle). */
  const lastSuccessfulPullListAtRef = useRef(0);
  const syncCycleLockRef = useRef(false);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const debouncedPushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const runPushAllSilentRef = useRef<() => Promise<void>>(async () => {});
  const runBackgroundSyncCycleRef = useRef<() => Promise<void>>(async () => {});
  const ablyDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  useEffect(() => {
    if (!dbReady || !db) return;
    void (async () => {
      await ensureSettingsRow(db);
      const s = await db.settings.get(1);
      if (s?.lastCloudPushAt) setLastPushAt(new Date(s.lastCloudPushAt));
      if (s?.lastCloudPullAt) setLastPullAt(new Date(s.lastCloudPullAt));
    })();
  }, [db, dbReady]);

  const checkRemoteNewer = useCallback(async () => {
    if (
      status !== "authenticated" ||
      !dbReady ||
      !db ||
      currentEventId == null ||
      !currentEvent?.syncId ||
      !online
    ) {
      setRemoteBanner(null);
      return;
    }
    setChecking(true);
    try {
      const list = await fetchSyncList();
      if (!list.ok) {
        setRemoteBanner(null);
        if (list.status === 503) setCloudSyncAvailable(false);
        return;
      }
      setCloudSyncAvailable(true);
      const mine = list.events.find(
        (e) => e.eventSyncId === currentEvent.syncId
      );
      if (!mine) {
        setRemoteBanner(null);
        return;
      }
      const remoteT = new Date(mine.updatedAt).getTime();
      const lastPush = dateGetTime(currentEvent.lastCloudPushAt);
      if (lastPush == null || remoteT > lastPush) {
        setRemoteBanner({ serverUpdatedAt: mine.updatedAt });
      } else {
        setRemoteBanner(null);
      }
    } finally {
      setChecking(false);
    }
  }, [
    status,
    dbReady,
    db,
    currentEventId,
    currentEvent?.syncId,
    currentEvent?.lastCloudPushAt,
    online,
  ]);

  const runPullAndMaybeSwitchEvent = useCallback(async () => {
    if (status !== "authenticated" || !db || !online) return;
    const now = Date.now();
    if (
      lastSuccessfulPullListAtRef.current > 0 &&
      now - lastSuccessfulPullListAtRef.current < PULL_LIST_THROTTLE_MS
    ) {
      return;
    }

    const list = await fetchSyncList();
    if (!list.ok) {
      if (list.status === 503) setCloudSyncAvailable(false);
      return;
    }
    setCloudSyncAvailable(true);
    lastSuccessfulPullListAtRef.current = Date.now();

    setSyncPhase("pulling");
    try {
      const r = await pullCloudEventsMissingLocally(db, list.events);
      setLastPullAt(new Date());
      if (r.imported > 0 || list.events.length > 0) {
        refresh();
      }
      if (r.imported > 0) {
        await ensureSettingsRow(db);
        const settings = await db.settings.get(1);
        if (settings?.currentEventId == null) {
          const all = await db.events.toArray();
          all.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
          );
          const newest = all[0];
          if (newest?.id != null) await switchEvent(newest.id);
        }
      }
      if (r.fetchFailures > 0 && r.imported === 0) {
        setLastSyncError("Some cloud events could not be downloaded.");
      }
    } catch {
      setLastSyncError("Could not merge events from cloud.");
    } finally {
      setSyncPhase("idle");
    }
  }, [status, db, online, refresh, switchEvent]);

  const runPushAllSilent = useCallback(async () => {
    if (status !== "authenticated" || !db || !online) return;
    const count = await db.events.count();
    if (count === 0) return;

    setSyncPhase("pushing");
    try {
      if (isSyncOpsEnabled()) {
        await pushAllPendingOps(db);
      }
      const summary = await pushAllLocalEvents(db);
      if (summary.serverUnavailable) setCloudSyncAvailable(false);
      if (summary.lastUpdatedAt) {
        setLastPushAt(new Date(summary.lastUpdatedAt));
        refresh();
        setRemoteBanner(null);
        setLastSyncError(null);
      } else if (count > 0 && !summary.serverUnavailable) {
        if (summary.conflictCount > 0 && summary.okCount === 0) {
          setLastSyncError(
            "Cloud backup blocked — another device or teammate saved a newer backup. Settings → Restore from cloud, or Overwrite cloud copy if this device should win."
          );
        } else if (summary.failCount > 0 && summary.okCount === 0) {
          setLastSyncError("Cloud backup failed. Try Settings → Sync now.");
        }
      }
      if (summary.conflictCount > 0) {
        await checkRemoteNewer();
      }
    } catch {
      setLastSyncError("Cloud backup failed. Try again.");
    } finally {
      setSyncPhase("idle");
    }
  }, [status, db, online, refresh, checkRemoteNewer]);

  useEffect(() => {
    runPushAllSilentRef.current = runPushAllSilent;
  }, [runPushAllSilent]);

  const scheduleCloudPush = useCallback(() => {
    if (status !== "authenticated" || !online) return;
    if (debouncedPushTimerRef.current) {
      clearTimeout(debouncedPushTimerRef.current);
    }
    debouncedPushTimerRef.current = setTimeout(() => {
      debouncedPushTimerRef.current = null;
      void runPushAllSilentRef.current();
    }, 1200);
  }, [status, online]);

  const ensureCloudBackupBeforeSignOut = useCallback(async (): Promise<boolean> => {
    if (status !== "authenticated" || !db) {
      showToast({
        kind: "error",
        message: "Sign out isn’t available right now. Try again.",
      });
      return false;
    }
    const eventCount = await db.events.count();
    if (eventCount === 0) {
      return true;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      showToast({
        kind: "error",
        message:
          "You’re offline. Connect to the internet so we can save your auction data to your account, then sign out again.",
      });
      return false;
    }
    if (debouncedPushTimerRef.current) {
      clearTimeout(debouncedPushTimerRef.current);
      debouncedPushTimerRef.current = null;
    }
    setSyncPhase("pushing");
    try {
      if (isSyncOpsEnabled()) {
        await pushAllPendingOps(db);
      }
      const summary = await pushAllLocalEvents(db);
      if (summary.serverUnavailable) {
        setCloudSyncAvailable(false);
        showToast({
          kind: "error",
          message:
            "Cloud backup isn’t available on this server. Export your events from Settings, or fix backup setup, before signing out.",
        });
        return false;
      }
      const fullySynced =
        summary.okCount === eventCount &&
        summary.failCount === 0 &&
        summary.conflictCount === 0;
      if (summary.lastUpdatedAt) {
        setLastPushAt(new Date(summary.lastUpdatedAt));
        refresh();
        setRemoteBanner(null);
      }
      if (fullySynced) {
        setLastSyncError(null);
        showToast({
          kind: "success",
          message: "Latest data saved to your account. Signing you out…",
        });
        return true;
      }
      if (summary.conflictCount > 0) {
        showToast({
          kind: "error",
          message:
            "Cloud conflict (someone else may have saved newer data). Open Settings → Restore from cloud or Overwrite cloud copy, then sign out again.",
        });
      } else {
        showToast({
          kind: "error",
          message:
            "Could not save all events to the cloud. Check your connection and try signing out again.",
        });
      }
      return false;
    } catch {
      showToast({
        kind: "error",
        message:
          "Could not reach cloud backup. Try again with a stable connection.",
      });
      return false;
    } finally {
      setSyncPhase("idle");
    }
  }, [status, db, refresh, showToast]);

  useEffect(() => {
    const flush = () => {
      if (debouncedPushTimerRef.current) {
        clearTimeout(debouncedPushTimerRef.current);
        debouncedPushTimerRef.current = null;
      }
      if (
        status !== "authenticated" ||
        !dbReady ||
        !db ||
        (typeof navigator !== "undefined" && !navigator.onLine)
      ) {
        return;
      }
      void runPushAllSilentRef.current();
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [status, db, dbReady]);

  const runBackgroundSyncCycle = useCallback(async () => {
    if (syncCycleLockRef.current) return;
    if (status !== "authenticated" || !dbReady || !db || !online) return;
    syncCycleLockRef.current = true;
    try {
      await runPullAndMaybeSwitchEvent();
      if (db && isSyncOpsEnabled()) {
        const opSummary = await runOperationLevelSync(db);
        if (opSummary.pulledApplied > 0) {
          refresh();
        }
      }
      await runPushAllSilent();
    } finally {
      syncCycleLockRef.current = false;
    }
  }, [
    status,
    dbReady,
    db,
    online,
    runPullAndMaybeSwitchEvent,
    runPushAllSilent,
    refresh,
  ]);

  useEffect(() => {
    runBackgroundSyncCycleRef.current = runBackgroundSyncCycle;
  }, [runBackgroundSyncCycle]);

  useEffect(() => {
    if (!isAblyRealtimeSyncEnabled()) return;
    if (status !== "authenticated" || !online) return;
    const vendorRaw = session?.user?.vendorId;
    const syncId = currentEvent?.syncId?.trim();
    if (!vendorRaw || !syncId) return;
    const vendorId = parseInt(vendorRaw, 10);
    if (!Number.isFinite(vendorId)) return;

    const channelName = eventSyncChannelName(vendorId, syncId);

    const scheduleNudgedSync = () => {
      if (ablyDebounceTimerRef.current) {
        clearTimeout(ablyDebounceTimerRef.current);
      }
      ablyDebounceTimerRef.current = setTimeout(() => {
        ablyDebounceTimerRef.current = null;
        void runBackgroundSyncCycleRef.current();
      }, 400);
    };

    const realtime = new Ably.Realtime({
      authCallback: (_tokenParams, callback) => {
        void (async () => {
          try {
            const res = await fetch("/api/ably/auth", {
              method: "POST",
              credentials: "include",
            });
            if (!res.ok) {
              callback(`Ably auth failed (${res.status})`, null);
              return;
            }
            const tokenRequest = await res.json();
            callback(null, tokenRequest as never);
          } catch (e) {
            callback(
              e instanceof Error ? e.message : "Ably auth request failed",
              null
            );
          }
        })();
      },
    });

    const channel = realtime.channels.get(channelName);
    const onSync = () => {
      scheduleNudgedSync();
    };

    void channel
      .subscribe("sync", onSync)
      .catch((e: unknown) => {
        console.error("[ably] subscribe failed", e);
      });

    return () => {
      if (ablyDebounceTimerRef.current) {
        clearTimeout(ablyDebounceTimerRef.current);
        ablyDebounceTimerRef.current = null;
      }
      channel.unsubscribe("sync", onSync);
      realtime.close();
    };
  }, [status, online, session?.user?.vendorId, currentEvent?.syncId]);

  /**
   * As soon as the signed-in user’s Dexie DB is ready, run one full sync cycle.
   * Otherwise the first pull waited on a 3s timer and the UI could stay empty
   * on a second device even though backups exist on the server.
   */
  const didImmediatePostDbReadySyncRef = useRef(false);
  /** New login or different account must be allowed to run immediate sync again. */
  useEffect(() => {
    didImmediatePostDbReadySyncRef.current = false;
  }, [session?.user?.id]);
  useEffect(() => {
    if (didImmediatePostDbReadySyncRef.current) return;
    if (status !== "authenticated" || !dbReady || !db || !online) {
      return;
    }
    didImmediatePostDbReadySyncRef.current = true;
    lastSuccessfulPullListAtRef.current = 0;
    void runBackgroundSyncCycle();
  }, [status, dbReady, db, online, runBackgroundSyncCycle]);

  useEffect(() => {
    const fn = () => setOnline(navigator.onLine);
    window.addEventListener("online", fn);
    window.addEventListener("offline", fn);
    return () => {
      window.removeEventListener("online", fn);
      window.removeEventListener("offline", fn);
    };
  }, []);

  useEffect(() => {
    void checkRemoteNewer();
  }, [checkRemoteNewer]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void checkRemoteNewer();
      void runBackgroundSyncCycle();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [checkRemoteNewer, runBackgroundSyncCycle]);

  useEffect(() => {
    const onOnline = () => {
      void runBackgroundSyncCycle();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [runBackgroundSyncCycle]);

  useEffect(() => {
    const id = setInterval(() => void checkRemoteNewer(), REMOTE_NEWER_CHECK_MS);
    return () => clearInterval(id);
  }, [checkRemoteNewer]);

  useEffect(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    if (status !== "authenticated" || !dbReady || !db || !online) {
      return;
    }
    syncIntervalRef.current = setInterval(() => {
      void runBackgroundSyncCycle();
    }, PUSH_ALL_INTERVAL_MS);
    const t = setTimeout(() => void runBackgroundSyncCycle(), 3_000);
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      clearTimeout(t);
    };
  }, [status, db, dbReady, online, runBackgroundSyncCycle]);

  const runPushCurrent = useCallback(
    async (options?: { force?: boolean }): Promise<PushResult> => {
      if (
        status !== "authenticated" ||
        !db ||
        currentEventId == null ||
        !online
      ) {
        return { ok: false, message: "You are offline or no event selected." };
      }
      try {
        const result = await pushCurrentEvent(db, currentEventId, options);
        if (result.ok) {
          await recordSuccessfulPush(db, currentEventId, result.updatedAt);
          setLastPushAt(new Date(result.updatedAt));
          await ensureSettingsRow(db);
          await db.settings.update(1, {
            lastCloudPushAt: new Date(result.updatedAt),
          });
          refresh();
          setRemoteBanner(null);
          setLastSyncError(null);
          return { ok: true };
        }
        if (result.conflict) {
          await checkRemoteNewer();
          return {
            ok: false,
            message:
              "A newer backup is on the server (another device or teammate). Restore from cloud or push to overwrite.",
          };
        }
        if (result.status === 503) setCloudSyncAvailable(false);
        return {
          ok: false,
          message:
            result.status === 503
              ? "Cloud backup is not set up on the server yet."
              : "Cloud backup failed. Try again.",
        };
      } catch {
        return { ok: false, message: "Cloud backup failed. Try again." };
      }
    },
    [status, db, currentEventId, online, refresh, checkRemoteNewer]
  );

  const pushNow = useCallback(
    async (options?: { force?: boolean }) => {
      if (status !== "authenticated" || !db || !online) {
        showToast({
          kind: "error",
          message: "You must be online to back up to the cloud.",
        });
        return false;
      }
      const count = await db.events.count();
      if (count === 0) {
        showToast({
          kind: "error",
          message: "Create an event before backing up to the cloud.",
        });
        return false;
      }
      setSyncPhase("pushing");
      try {
        if (isSyncOpsEnabled()) {
          await pushAllPendingOps(db);
        }
        const summary = await pushAllLocalEvents(db, options);
        if (summary.serverUnavailable) setCloudSyncAvailable(false);
        if (summary.lastUpdatedAt) {
          setLastPushAt(new Date(summary.lastUpdatedAt));
          refresh();
          setRemoteBanner(null);
        }
        if (summary.serverUnavailable) {
          showToast({
            kind: "error",
            message: "Cloud backup is not set up on the server yet.",
          });
          return false;
        }
        if (summary.failCount === 0) {
          if (summary.conflictCount > 0) {
            showToast({
              kind: "success",
              message: `${summary.okCount} event(s) saved. ${summary.conflictCount} conflict(s): another copy on the server is newer — use the banner or Settings (Restore / Overwrite).`,
            });
          } else {
            showToast({
              kind: "success",
              message: `Saved ${summary.okCount} event(s) to cloud backup.`,
            });
          }
          setLastSyncError(null);
          return true;
        }
        if (summary.okCount > 0) {
          showToast({
            kind: "success",
            message: `Partial backup: ${summary.okCount} saved, ${summary.failCount} failed.`,
          });
          setLastSyncError(null);
          return true;
        }
        showToast({
          kind: "error",
          message: "Cloud backup failed. Try again.",
        });
        return false;
      } catch {
        showToast({ kind: "error", message: "Cloud backup failed. Try again." });
        return false;
      } finally {
        setSyncPhase("idle");
      }
    },
    [status, db, online, refresh, showToast]
  );

  const restoreFromCloud = useCallback(async () => {
    if (!db || currentEventId == null || !currentEvent?.syncId) return false;
    try {
      const r = await restoreEventFromCloud(
        db,
        currentEventId,
        currentEvent.syncId
      );
      if (!r.ok) {
        showToast({ kind: "error", message: "Could not restore from cloud." });
        return false;
      }
      await ensureSettingsRow(db);
      await db.settings.update(1, { lastCloudPullAt: new Date(r.updatedAt) });
      setLastPullAt(new Date(r.updatedAt));
      refresh();
      setRemoteBanner(null);
      setLastSyncError(null);
      showToast({
        kind: "success",
        message: "Restored event from cloud backup.",
      });
      return true;
    } catch {
      showToast({ kind: "error", message: "Restore failed." });
      return false;
    }
  }, [db, currentEventId, currentEvent?.syncId, refresh, showToast]);

  const dismissBanner = useCallback(() => setRemoteBanner(null), []);

  const forcePush = useCallback(async () => {
    const r = await runPushCurrent({ force: true });
    if (r.ok) {
      showToast({
        kind: "success",
        message: "Cloud backup updated from this device.",
      });
    } else {
      showToast({ kind: "error", message: r.message });
    }
  }, [runPushCurrent, showToast]);

  const ctxValue = useMemo<CloudSyncContextValue>(
    () => ({
      pushNow,
      restoreFromCloud,
      lastPushAt,
      lastPullAt,
      checking,
      online,
      syncPhase,
      lastSyncError,
      cloudSyncAvailable,
      scheduleCloudPush,
      ensureCloudBackupBeforeSignOut,
    }),
    [
      pushNow,
      restoreFromCloud,
      lastPushAt,
      lastPullAt,
      checking,
      online,
      syncPhase,
      lastSyncError,
      cloudSyncAvailable,
      scheduleCloudPush,
      ensureCloudBackupBeforeSignOut,
    ]
  );

  const impersonationBanner =
    session?.impersonatedByUserId != null ? <ImpersonationBanner /> : null;

  const syncConflictBanner =
    remoteBanner && currentEventId != null ? (
      <div
        className="flex flex-col gap-3 rounded-xl border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink sm:flex-row sm:items-center sm:justify-between"
        role="status"
      >
        <p>
          <span className="font-semibold text-navy dark:text-slate-100">
            Newer cloud backup
          </span>{" "}
          for this event (server{" "}
          {new Date(remoteBanner.serverUpdatedAt).toLocaleString()}). Restore to
          use it, or push to replace the server copy.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => void restoreFromCloud()}>
            Restore from cloud
          </Button>
          <Button type="button" variant="secondary" onClick={() => void forcePush()}>
            Push this device
          </Button>
          <Button type="button" variant="secondary" onClick={dismissBanner}>
            Dismiss
          </Button>
        </div>
      </div>
    ) : null;

  const topBanner =
    impersonationBanner || syncConflictBanner ? (
      <div className="space-y-3">
        {impersonationBanner}
        {syncConflictBanner}
      </div>
    ) : null;

  return (
    <CloudSyncContext.Provider value={ctxValue}>
      <AppShell topBanner={topBanner}>
        {children}
      </AppShell>
    </CloudSyncContext.Provider>
  );
}
