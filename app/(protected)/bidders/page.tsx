"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { BidderForm } from "@/components/bidders/BidderForm";
import { BidderSearch } from "@/components/bidders/BidderSearch";
import { BidderTable } from "@/components/bidders/BidderTable";
import { useCurrentEvent } from "@/lib/hooks/useCurrentEvent";
import {
  countSalesForBidder,
  useBiddersForEvent,
  type BidderRow,
} from "@/lib/hooks/useBidders";
import { useToast } from "@/components/providers/ToastProvider";
import { useUserDb } from "@/components/providers/UserDbProvider";

const linkSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-navy/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2";

function matchesSearch(b: BidderRow, q: string): boolean {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  const paddle = String(b.paddleNumber);
  const name = `${b.firstName} ${b.lastName}`.toLowerCase();
  return (
    paddle.includes(s) ||
    name.includes(s) ||
    (b.phone?.toLowerCase().includes(s) ?? false) ||
    (b.email?.toLowerCase().includes(s) ?? false)
  );
}

export default function BiddersPage() {
  const { db } = useUserDb();
  const { currentEvent, currentEventId } = useCurrentEvent();
  const { showToast } = useToast();
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BidderRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BidderRow | null>(null);

  const rows = useBiddersForEvent(currentEventId ?? undefined);
  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((b) => matchesSearch(b, search));
  }, [rows, search]);

  const sym = currentEvent?.currencySymbol ?? "$";

  if (currentEventId == null || !currentEvent) {
    return (
      <div>
        <Header
          title="Bidders"
          description="Select an event in the sidebar to manage bidders."
          actions={
            <Link href="/events/" className={linkSecondary}>
              Events
            </Link>
          }
        />
        <p className="text-sm text-muted">No event selected.</p>
      </div>
    );
  }

  return (
    <div>
      <Header
        title="Bidders"
        description={`Register and manage bidders for ${currentEvent.name}.`}
        actions={
          <>
            <Link href="/events/" className={linkSecondary}>
              Events
            </Link>
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              Register bidder
            </Button>
          </>
        }
      />

      <div className="mb-6 max-w-md">
        <BidderSearch value={search} onChange={setSearch} />
      </div>

      {!rows ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <BidderTable
          rows={filtered}
          currencySymbol={sym}
          onEdit={(b) => {
            setEditing(b);
            setFormOpen(true);
          }}
          onDelete={(b) => setDeleteTarget(b)}
        />
      )}

      <BidderForm
        open={formOpen}
        eventId={currentEventId}
        editing={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSaved={() => showToast({ kind: "success", message: "Bidder saved." })}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        title="Delete bidder"
        message={
          deleteTarget
            ? `Remove ${deleteTarget.firstName} ${deleteTarget.lastName} (paddle #${deleteTarget.paddleNumber})?`
            : ""
        }
        confirmLabel="Delete"
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget?.id == null || !db) return;
          const id = deleteTarget.id;
          const n = await countSalesForBidder(db, id);
          if (n > 0) {
            showToast({
              kind: "error",
              message: "Cannot delete a bidder with recorded sales.",
            });
            setDeleteTarget(null);
            return;
          }
          setDeleteTarget(null);
          await db.bidders.delete(id);
          showToast({ kind: "success", message: "Bidder removed." });
        }}
      />
    </div>
  );
}
