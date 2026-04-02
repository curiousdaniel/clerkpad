"use client";

import { useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { EventForm } from "@/components/events/EventForm";
import { EventCard } from "@/components/events/EventCard";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useCurrentEvent } from "@/lib/hooks/useCurrentEvent";
import { useToast } from "@/components/providers/ToastProvider";
import type { AuctionEvent } from "@/lib/db";
import { useUserDb } from "@/components/providers/UserDbProvider";
import {
  buildEventExport,
  downloadJson,
  importEventFromPayload,
  parseEventExportPayload,
} from "@/lib/services/dataPorter";
import { deleteEventCascade } from "@/lib/services/eventService";
import { downloadCsv } from "@/lib/services/csvExporter";
import { parseLotCsv } from "@/lib/services/csvImportLots";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

export default function EventsPage() {
  const { db, ready: dbReady } = useUserDb();
  const { ready, currentEventId, switchEvent, refresh } = useCurrentEvent();
  const { showToast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const lotsCsvRef = useRef<HTMLInputElement>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AuctionEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AuctionEvent | null>(null);

  const events = useLiveQuery(
    async () =>
      liveQueryGuard("events.page.list", async () => {
        if (!ready || !dbReady || !db) return [];
        return db.events.orderBy("createdAt").reverse().toArray();
      }, []),
    [ready, dbReady, db]
  );

  async function handleExport(eventId: number, slug: string) {
    if (!db) return;
    try {
      const data = await buildEventExport(db, eventId);
      const safe = slug.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 40);
      downloadJson(`clerkbid-event-${safe || eventId}.json`, data);
      showToast({ kind: "success", message: "Event exported." });
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Export failed.",
      });
    }
  }

  function onPickImportFile() {
    fileRef.current?.click();
  }

  async function onImportFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !db) return;
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as unknown;
      const payload = parseEventExportPayload(raw);
      const summary = await importEventFromPayload(db, payload);
      showToast({
        kind: "success",
        message: `Imported: ${summary.bidders} bidders, ${summary.lots} lots, ${summary.sales} sales.`,
      });
      await switchEvent(summary.eventId);
      refresh();
    } catch (err) {
      showToast({
        kind: "error",
        message: err instanceof Error ? err.message : "Import failed.",
      });
    }
  }

  return (
    <div>
      <Header
        title="Events"
        description="Create, switch, export, and import auction events. Data stays on this device."
        actions={
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              aria-hidden
              onChange={onImportFileChange}
            />
            <Button variant="secondary" type="button" onClick={onPickImportFile}>
              Import event (JSON)
            </Button>
            <input
              ref={lotsCsvRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              aria-hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file || !db || currentEventId == null) return;
                try {
                  const text = await file.text();
                  const { rows, issues } = parseLotCsv(text);
                  const existing = await db.lots
                    .where("eventId")
                    .equals(currentEventId)
                    .toArray();
                  const taken = new Set(
                    existing.map((l) => l.displayLotNumber)
                  );
                  const conflicts: string[] = [];
                  const toAdd = rows.filter((r) => {
                    if (taken.has(r.displayLotNumber)) {
                      conflicts.push(r.displayLotNumber);
                      return false;
                    }
                    taken.add(r.displayLotNumber);
                    return true;
                  });
                  const now = new Date();
                  await db.transaction("rw", db.lots, async () => {
                    for (const r of toAdd) {
                      await db.lots.add({
                        eventId: currentEventId,
                        baseLotNumber: r.baseLotNumber,
                        lotSuffix: r.lotSuffix,
                        displayLotNumber: r.displayLotNumber,
                        description: r.description,
                        consignor: r.consignor,
                        quantity: r.quantity,
                        notes: r.notes,
                        status: "unsold",
                        createdAt: now,
                        updatedAt: now,
                      });
                    }
                  });
                  const parts: string[] = [];
                  if (toAdd.length) parts.push(`Imported ${toAdd.length} lot(s).`);
                  if (issues.length)
                    parts.push(`${issues.length} row issue(s) in file.`);
                  if (conflicts.length)
                    parts.push(
                      `Skipped ${conflicts.length} lot(s) already in this event.`
                    );
                  const ok =
                    toAdd.length > 0 &&
                    issues.length === 0 &&
                    conflicts.length === 0;
                  showToast({
                    kind: ok ? "success" : toAdd.length > 0 ? "info" : "error",
                    message: parts.join(" ") || "Nothing imported.",
                  });
                } catch (err) {
                  showToast({
                    kind: "error",
                    message:
                      err instanceof Error ? err.message : "CSV import failed.",
                  });
                }
              }}
            />
            <Button
              variant="secondary"
              type="button"
              disabled={currentEventId == null}
              title={
                currentEventId == null
                  ? "Select an event in the sidebar first"
                  : undefined
              }
              onClick={() =>
                downloadCsv("clerkbid-lots-template.csv", [
                  "baseLotNumber",
                  "suffix",
                  "description",
                  "consignor",
                  "quantity",
                  "notes",
                ], [
                  [1, "", "Sample lot description", "Consignor LLC", 1, "Ring note"],
                ])
              }
            >
              Lots CSV template
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={currentEventId == null}
              title={
                currentEventId == null
                  ? "Select an event in the sidebar first"
                  : undefined
              }
              onClick={() => lotsCsvRef.current?.click()}
            >
              Import lots (CSV)
            </Button>
            <Button type="button" onClick={() => { setEditing(null); setFormOpen(true); }}>
              Create new event
            </Button>
          </>
        }
      />

      {!ready || !events ? (
        <p className="text-muted">Loading…</p>
      ) : events.length === 0 ? (
        <div className="rounded-xl border border-dashed border-navy/20 bg-surface/50 p-10 text-center">
          <p className="text-muted">No events yet.</p>
          <Button
            className="mt-4"
            type="button"
            onClick={() => { setEditing(null); setFormOpen(true); }}
          >
            Create your first event
          </Button>
        </div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {events.map((ev) => (
            <li key={ev.id}>
              <EventCard
                event={ev}
                isCurrent={ev.id === currentEventId}
                onSwitch={() => void switchEvent(ev.id!)}
                onEdit={() => {
                  setEditing(ev);
                  setFormOpen(true);
                }}
                onDelete={() => setDeleteTarget(ev)}
                onExport={() =>
                  void handleExport(ev.id!, ev.name)}
              />
            </li>
          ))}
        </ul>
      )}

      <EventForm
        open={formOpen}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          refresh();
          showToast({ kind: "success", message: "Event saved." });
        }}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete event"
        message={
          deleteTarget
            ? `Permanently delete “${deleteTarget.name}” and all bidders, lots, sales, and invoices for this event? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete permanently"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget?.id == null || !db) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          await deleteEventCascade(db, id);
          refresh();
          showToast({ kind: "success", message: "Event deleted." });
        }}
      />
    </div>
  );
}
