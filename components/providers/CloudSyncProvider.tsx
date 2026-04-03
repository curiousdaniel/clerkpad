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
import { useUserDb } from "@/components/providers/UserDbProvider";
import { useEventContext } from "@/components/providers/EventProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import {
  fetchSyncList,
  pushCurrentEvent,
  recordSuccessfulPush,
  restoreEventFromCloud,
} from "@/lib/services/cloudSync";
import { ensureSettingsRow } from "@/lib/settings";
import { dateGetTime } from "@/lib/utils/coerceDate";

type PushResult = { ok: true } | { ok: false; message: string };

type CloudSyncContextValue = {
  pushNow: (options?: { force?: boolean }) => Promise<boolean>;
  restoreFromCloud: () => Promise<boolean>;
  lastPushAt: Date | null;
  checking: boolean;
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
  const { currentEventId, currentEvent, refresh } = useEventContext();
  const { showToast } = useToast();

  const [online, setOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [remoteBanner, setRemoteBanner] = useState<{
    serverUpdatedAt: string;
  } | null>(null);
  const [lastPushAt, setLastPushAt] = useState<Date | null>(null);
  const [checking, setChecking] = useState(false);
  const pushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        return;
      }
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
      if (document.visibilityState === "visible") void checkRemoteNewer();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [checkRemoteNewer]);

  useEffect(() => {
    const id = setInterval(() => void checkRemoteNewer(), 90_000);
    return () => clearInterval(id);
  }, [checkRemoteNewer]);

  const runPush = useCallback(
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
          return { ok: true };
        }
        if (result.conflict) {
          await checkRemoteNewer();
          return {
            ok: false,
            message:
              "A newer backup exists on the server. Restore from cloud or push to overwrite.",
          };
        }
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

  useEffect(() => {
    if (pushTimerRef.current) {
      clearInterval(pushTimerRef.current);
      pushTimerRef.current = null;
    }
    if (
      status !== "authenticated" ||
      !db ||
      currentEventId == null ||
      !online
    ) {
      return;
    }
    pushTimerRef.current = setInterval(() => {
      void runPush();
    }, 45_000);
    const t = setTimeout(() => void runPush(), 3_000);
    return () => {
      if (pushTimerRef.current) clearInterval(pushTimerRef.current);
      clearTimeout(t);
    };
  }, [status, db, currentEventId, online, runPush]);

  const pushNow = useCallback(
    async (options?: { force?: boolean }) => {
      const r = await runPush(options);
      if (r.ok) {
        showToast({ kind: "success", message: "Saved to cloud backup." });
        return true;
      }
      showToast({ kind: "error", message: r.message });
      return false;
    },
    [runPush, showToast]
  );

  const restoreFromCloud = useCallback(async () => {
    if (!db || currentEventId == null || !currentEvent?.syncId) return false;
    try {
      const r = await restoreEventFromCloud(db, currentEventId, currentEvent.syncId);
      if (!r.ok) {
        showToast({ kind: "error", message: "Could not restore from cloud." });
        return false;
      }
      await ensureSettingsRow(db);
      await db.settings.update(1, { lastCloudPullAt: new Date(r.updatedAt) });
      refresh();
      setRemoteBanner(null);
      showToast({ kind: "success", message: "Restored event from cloud backup." });
      return true;
    } catch {
      showToast({ kind: "error", message: "Restore failed." });
      return false;
    }
  }, [db, currentEventId, currentEvent?.syncId, refresh, showToast]);

  const dismissBanner = useCallback(() => setRemoteBanner(null), []);

  const forcePush = useCallback(async () => {
    const r = await runPush({ force: true });
    if (r.ok) {
      showToast({ kind: "success", message: "Cloud backup updated from this device." });
    } else {
      showToast({ kind: "error", message: r.message });
    }
  }, [runPush, showToast]);

  const ctxValue = useMemo<CloudSyncContextValue>(
    () => ({
      pushNow,
      restoreFromCloud,
      lastPushAt,
      checking,
    }),
    [pushNow, restoreFromCloud, lastPushAt, checking]
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
          <span className="font-semibold text-navy">Newer cloud backup</span>{" "}
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
      <AppShell topBanner={topBanner}>{children}</AppShell>
    </CloudSyncContext.Provider>
  );
}
