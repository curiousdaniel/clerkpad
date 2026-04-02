"use client";

import { useLiveQuery } from "dexie-react-hooks";
import type { AuctionEvent } from "@/lib/db";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { formatDateOnly } from "@/lib/utils/formatDate";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

export function EventCard({
  event,
  isCurrent,
  onSwitch,
  onEdit,
  onDelete,
  onExport,
}: {
  event: AuctionEvent;
  isCurrent: boolean;
  onSwitch: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onExport: () => void;
}) {
  const { db, ready } = useUserDb();
  const id = event.id!;
  const counts = useLiveQuery(
    async () =>
      liveQueryGuard(`eventCard.counts(${id})`, async () => {
        if (!ready || !db) return { bidders: 0, lots: 0, sales: 0 };
        const [bidders, lots, sales] = await Promise.all([
          db.bidders.where("eventId").equals(id).count(),
          db.lots.where("eventId").equals(id).count(),
          db.sales.where("eventId").equals(id).count(),
        ]);
        return { bidders, lots, sales };
      }, { bidders: 0, lots: 0, sales: 0 }),
    [ready, db, id]
  );

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-navy">{event.name}</h2>
            {isCurrent ? <Badge tone="success">Current</Badge> : null}
          </div>
          {event.description ? (
            <p className="mt-1 text-sm text-muted">{event.description}</p>
          ) : null}
          <p className="mt-2 text-xs text-muted">
            {event.organizationName} · Created{" "}
            {formatDateOnly(event.createdAt)}
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-center text-sm">
        <div className="rounded-lg bg-surface px-2 py-2">
          <dt className="text-xs text-muted">Bidders</dt>
          <dd className="font-mono font-semibold text-ink">
            {counts?.bidders ?? "—"}
          </dd>
        </div>
        <div className="rounded-lg bg-surface px-2 py-2">
          <dt className="text-xs text-muted">Lots</dt>
          <dd className="font-mono font-semibold text-ink">
            {counts?.lots ?? "—"}
          </dd>
        </div>
        <div className="rounded-lg bg-surface px-2 py-2">
          <dt className="text-xs text-muted">Sales</dt>
          <dd className="font-mono font-semibold text-ink">
            {counts?.sales ?? "—"}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={onSwitch}>
          Switch to event
        </Button>
        <Button type="button" variant="secondary" onClick={onEdit}>
          Edit
        </Button>
        <Button type="button" variant="secondary" onClick={onExport}>
          Export JSON
        </Button>
        <Button type="button" variant="danger" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  );
}
