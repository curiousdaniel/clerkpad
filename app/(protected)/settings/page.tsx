"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EventSettingsForm } from "@/components/settings/EventSettingsForm";
import { ClearEventDataDialog } from "@/components/settings/ClearEventDataDialog";
import { useCurrentEvent } from "@/lib/hooks/useCurrentEvent";
import { usePwaInstall } from "@/lib/hooks/usePwaInstall";
import { useToast } from "@/components/providers/ToastProvider";
import { useCloudSync } from "@/components/providers/CloudSyncProvider";
import type { AuctionDB } from "@/lib/db";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { ensureSettingsRow } from "@/lib/settings";
import {
  buildEventExport,
  buildFullDatabaseExport,
  downloadJson,
  importEventFromPayload,
  importFullDatabaseEvents,
  parseEventExportPayload,
  parseFullDatabaseExport,
} from "@/lib/services/dataPorter";
import { clearEventDataKeepShell } from "@/lib/services/eventService";
import { APP_VERSION } from "@/lib/utils/constants";
import { formatBytes } from "@/lib/utils/formatBytes";
import { formatDateTime } from "@/lib/utils/formatDate";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

const linkSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-navy/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2";

async function touchBackupDate(db: AuctionDB) {
  await ensureSettingsRow(db);
  await db.settings.update(1, { lastBackupDate: new Date() });
}

export default function SettingsPage() {
  const { db, ready: dbReady } = useUserDb();
  const { currentEvent, currentEventId, switchEvent, refresh } =
    useCurrentEvent();
  const { showToast } = useToast();
  const { pushNow, restoreFromCloud, lastPushAt, checking } = useCloudSync();
  const { isStandalone, canInstall, promptInstall } = usePwaInstall();
  const [clearOpen, setClearOpen] = useState(false);
  const [monthlyBackupEmail, setMonthlyBackupEmail] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number }>(
    {}
  );

  const fileEventRef = useRef<HTMLInputElement>(null);
  const fileFullRef = useRef<HTMLInputElement>(null);

  const settingsRow = useLiveQuery(
    async () =>
      liveQueryGuard("settings.page.settings", async () => {
        if (!dbReady || !db) return undefined;
        await ensureSettingsRow(db);
        return db.settings.get(1);
      }, undefined),
    [dbReady, db]
  );

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
      return;
    }
    void navigator.storage.estimate().then((e) => {
      setStorage({ usage: e.usage, quota: e.quota });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/sync/preferences/", { credentials: "include" });
        if (!res.ok) return;
        const data = (await res.json()) as { monthlyBackupEmail?: boolean };
        if (!cancelled) {
          setMonthlyBackupEmail(data.monthlyBackupEmail === true);
          setPrefsLoaded(true);
        }
      } catch {
        if (!cancelled) setPrefsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function slug(name: string) {
    return name.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 40) || "event";
  }

  async function exportCurrentEvent() {
    if (currentEventId == null || !db) return;
    try {
      const data = await buildEventExport(db, currentEventId, APP_VERSION);
      downloadJson(
        `clerkbid-event-${slug(currentEvent?.name ?? "export")}.json`,
        data
      );
      await touchBackupDate(db);
      refresh();
      showToast({ kind: "success", message: "Event exported." });
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Export failed.",
      });
    }
  }

  async function exportAllEvents() {
    if (!db) return;
    try {
      const data = await buildFullDatabaseExport(db, APP_VERSION);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadJson(`clerkbid-all-events-${stamp}.json`, data);
      await touchBackupDate(db);
      refresh();
      showToast({ kind: "success", message: "Full database exported." });
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Export failed.",
      });
    }
  }

  async function onImportEventFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !db) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const payload = parseEventExportPayload(raw);
      const summary = await importEventFromPayload(db, payload);
      await switchEvent(summary.eventId);
      refresh();
      showToast({
        kind: "success",
        message: `Imported event: ${summary.bidders} bidders, ${summary.lots} lots.`,
      });
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Import failed.",
      });
    }
  }

  async function onImportFullFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !db) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const data = parseFullDatabaseExport(raw);
      const { imported, failures } = await importFullDatabaseEvents(db, data);
      refresh();
      const msg =
        failures.length === 0
          ? `Imported ${imported} event(s).`
          : `Imported ${imported} event(s). ${failures.length} failed — check messages.`;
      showToast({
        kind: failures.length ? "error" : "success",
        message: msg,
      });
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Import failed.",
      });
    }
  }

  async function handleClearConfirmed() {
    if (currentEventId == null || !db) return;
    await clearEventDataKeepShell(db, currentEventId);
    setClearOpen(false);
    refresh();
    showToast({
      kind: "success",
      message: "All clerking data cleared for this event.",
    });
  }

  return (
    <div className="space-y-10">
      <Header
        title="Settings"
        description="Event details, backups, and app information."
        actions={
          <Link href="/events/" className={linkSecondary}>
            Events
          </Link>
        }
      />

      {currentEvent && currentEventId != null ? (
        <EventSettingsForm
          event={currentEvent}
          onSaved={() => {
            refresh();
            showToast({ kind: "success", message: "Event settings saved." });
          }}
        />
      ) : (
        <Card>
          <p className="text-sm text-muted">
            Select an event in the sidebar to edit organization name, tax rate,
            and currency.
          </p>
        </Card>
      )}

      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">Cloud backup</h2>
        <Card className="space-y-4">
          <p className="text-sm text-muted">
            While signed in, the current event is saved to your account on the
            server (encrypted at rest on the database). Use this if you switch
            devices or want a safety copy beyond this browser.
          </p>
          {currentEvent ? (
            <p className="text-xs text-muted">
              Event sync ID:{" "}
              <span className="font-mono text-ink">{currentEvent.syncId}</span>
            </p>
          ) : null}
          <p className="text-xs text-muted">
            {checking
              ? "Checking server…"
              : currentEvent?.lastCloudPushAt
                ? `Last cloud save: ${formatDateTime(currentEvent.lastCloudPushAt)}`
                : lastPushAt
                  ? `Last cloud save: ${formatDateTime(lastPushAt)}`
                  : "No cloud save recorded for this event yet."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={currentEventId == null}
              onClick={() => void pushNow()}
            >
              Sync now
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={currentEventId == null}
              onClick={() => {
                if (
                  !window.confirm(
                    "Replace this event’s data on this device with the latest cloud backup? Unsaved local changes since your last cloud save will be lost."
                  )
                ) {
                  return;
                }
                void restoreFromCloud();
              }}
            >
              Restore from cloud
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={currentEventId == null}
              onClick={() => {
                if (
                  !window.confirm(
                    "Overwrite the server backup with this device’s copy? Use this if the server has someone else’s data or an old version."
                  )
                ) {
                  return;
                }
                void pushNow({ force: true });
              }}
            >
              Push (overwrite server)
            </Button>
          </div>
          <p className="text-xs text-muted">
            Requires{" "}
            <code className="rounded bg-surface px-1">db/migrate_cloud_sync.sql</code>{" "}
            on your Neon database. JSON export below still works as a manual
            backup.
          </p>
          <div className="border-t border-navy/10 pt-4">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-navy/30"
                checked={monthlyBackupEmail}
                disabled={!prefsLoaded}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setMonthlyBackupEmail(checked);
                  try {
                    const res = await fetch("/api/sync/preferences/", {
                      method: "PATCH",
                      credentials: "include",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ monthlyBackupEmail: checked }),
                    });
                    if (!res.ok) {
                      setMonthlyBackupEmail(!checked);
                      showToast({
                        kind: "error",
                        message: "Could not save email backup preference.",
                      });
                      return;
                    }
                    showToast({
                      kind: "success",
                      message: checked
                        ? "Monthly email backup enabled."
                        : "Monthly email backup disabled.",
                    });
                  } catch {
                    setMonthlyBackupEmail(!checked);
                    showToast({
                      kind: "error",
                      message: "Could not save preference.",
                    });
                  }
                }}
              />
              <span>
                <span className="font-medium text-navy">
                  Email me a monthly JSON backup
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  On the 1st of each month (UTC), we email cloud snapshots to
                  your account address. Requires cloud saves, Resend, and{" "}
                  <code className="rounded bg-surface px-1">CRON_SECRET</code>{" "}
                  on Vercel.
                </span>
              </span>
            </label>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">Data management</h2>
        <Card className="space-y-4">
          <input
            ref={fileEventRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-hidden
            onChange={onImportEventFile}
          />
          <input
            ref={fileFullRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            aria-hidden
            onChange={onImportFullFile}
          />
          <p className="text-sm text-muted">
            Event data is stored in this browser per signed-in user — other
            accounts cannot see it. Cloud backup (above) and JSON exports are
            your safety net and transfer path.
            {settingsRow?.lastBackupDate ? (
              <span className="mt-1 block text-xs">
                Last backup recorded:{" "}
                {formatDateTime(settingsRow.lastBackupDate)}
              </span>
            ) : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={currentEventId == null}
              onClick={() => void exportCurrentEvent()}
            >
              Export current event
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => void exportAllEvents()}
            >
              Export all events
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileEventRef.current?.click()}
            >
              Import event (JSON)
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileFullRef.current?.click()}
            >
              Import full backup
            </Button>
          </div>
          <p className="text-xs text-muted">
            <strong>Import event</strong> uses a single-event ClerkBid export and
            creates a new event. <strong>Import full backup</strong> expects{" "}
            <code className="rounded bg-surface px-1">fullExportVersion: 1</code>{" "}
            with an <code className="rounded bg-surface px-1">events</code>{" "}
            array; each event is appended as new.
          </p>
          <div className="border-t border-navy/10 pt-4">
            <Button
              type="button"
              variant="danger"
              disabled={currentEventId == null}
              onClick={() => setClearOpen(true)}
            >
              Clear current event data…
            </Button>
            <p className="mt-2 text-xs text-muted">
              Removes bidders, lots, sales, and invoices for the selected event
              only. Requires three confirmations. The event shell remains.
            </p>
          </div>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-navy">About</h2>
        <Card className="space-y-3 text-sm">
          <p>
            <span className="font-semibold text-navy">ClerkBid</span> — offline
            auction clerking for fundraisers. Progressive Web App; primary
            data in IndexedDB with optional cloud backup when signed in.
          </p>
          <p className="text-muted">
            Version <span className="font-mono text-ink">{APP_VERSION}</span>
          </p>
          <p className="text-muted">
            <Link
              href="/user-agreement/"
              className="font-medium text-navy underline underline-offset-2"
            >
              User agreement
            </Link>
            <span className="mx-2 text-navy/25">·</span>
            <Link
              href="/privacy-policy/"
              className="font-medium text-navy underline underline-offset-2"
            >
              Privacy policy
            </Link>
            <span className="mx-2 text-navy/25">·</span>
            <Link
              href="/feedback/"
              className="font-medium text-navy underline underline-offset-2"
            >
              Feedback
            </Link>
          </p>
          <p className="text-muted">
            Storage (approx.): {formatBytes(storage.usage)} used
            {storage.quota != null
              ? ` of ${formatBytes(storage.quota)} available`
              : ""}
            {storage.usage == null && storage.quota == null
              ? " — estimate not available in this browser."
              : ""}
          </p>
          <div className="border-t border-navy/10 pt-3">
            {isStandalone ? (
              <p className="text-success">Running as installed app.</p>
            ) : canInstall ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-muted">Install ClerkBid for quick offline access.</p>
                <Button type="button" onClick={() => void promptInstall()}>
                  Install app
                </Button>
              </div>
            ) : (
              <p className="text-muted">
                Install: use your browser menu (“Install app” / “Add to Home
                Screen”) when offered. The install prompt appears when the site
                meets PWA criteria.
              </p>
            )}
          </div>
        </Card>
      </section>

      <ClearEventDataDialog
        open={clearOpen}
        eventName={currentEvent?.name ?? "this event"}
        onClose={() => setClearOpen(false)}
        onConfirm={() => void handleClearConfirmed()}
      />
    </div>
  );
}
