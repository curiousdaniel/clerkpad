"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { useCurrentEvent } from "@/lib/hooks/useCurrentEvent";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatDateTime } from "@/lib/utils/formatDate";

const linkPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2";
const linkSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-navy/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2";

export default function DashboardPage() {
  const { db, ready: dbReady } = useUserDb();
  const { ready, currentEventId, currentEvent } = useCurrentEvent();

  const stats = useLiveQuery(
    async () => {
      if (!ready || !dbReady || !db || currentEventId == null) return null;
      const eid = currentEventId;
      const [bidderCount, lots, sales, invoices] = await Promise.all([
        db.bidders.where("eventId").equals(eid).count(),
        db.lots.where("eventId").equals(eid).toArray(),
        db.sales.where("eventId").equals(eid).toArray(),
        db.invoices.where("eventId").equals(eid).toArray(),
      ]);
      const sold = lots.filter((l) => l.status === "sold").length;
      const unsold = lots.filter((l) => l.status === "unsold").length;
      const passed = lots.filter((l) => l.status === "passed").length;
      const withdrawn = lots.filter((l) => l.status === "withdrawn").length;
      const revenue = sales.reduce((a, s) => a + s.amount, 0);
      const invPaid = invoices.filter((i) => i.status === "paid").length;
      const invUnpaid = invoices.filter((i) => i.status === "unpaid").length;
      return {
        bidderCount,
        totalLots: lots.length,
        sold,
        unsold,
        passed,
        withdrawn,
        revenue,
        invPaid,
        invUnpaid,
        invTotal: invoices.length,
      };
    },
    [ready, dbReady, db, currentEventId]
  );

  const recentSales = useLiveQuery(
    async () => {
      if (!ready || !dbReady || !db || currentEventId == null) return [];
      const rows = await db.sales
        .where("eventId")
        .equals(currentEventId)
        .toArray();
      rows.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return rows.slice(0, 10);
    },
    [ready, dbReady, db, currentEventId]
  );

  const sym = currentEvent?.currencySymbol ?? "$";

  if (!ready) {
    return <p className="text-muted">Loading…</p>;
  }

  if (currentEventId == null || !currentEvent) {
    return (
      <div>
        <Header
          title="Dashboard"
          description="Select or create an event to see live stats and recent sales."
        />
        <div className="rounded-xl border border-dashed border-navy/20 bg-surface/50 p-10 text-center">
          <p className="text-lg font-medium text-navy">Welcome to ClerkBid</p>
          <p className="mt-2 text-sm text-muted">
            Create an event to start registering bidders and recording sales.
          </p>
          <Link href="/events/" className={`mt-6 ${linkPrimary}`}>
            Create your first event
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header
        title={currentEvent.name}
        description={currentEvent.organizationName}
        actions={
          <>
            <Link href="/bidders/" className={linkSecondary}>
              Register bidder
            </Link>
            <Link href="/clerking/" className={linkPrimary}>
              Record sale
            </Link>
            <Link href="/invoices/" className={linkSecondary}>
              Invoices
            </Link>
          </>
        }
      />

      {stats ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="!p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Bidders
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-navy">
              {stats.bidderCount}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Lots
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-navy">
              {stats.totalLots}
            </p>
            <p className="mt-1 text-xs text-muted">
              Sold {stats.sold} · Unsold {stats.unsold} · Passed {stats.passed}
              {stats.withdrawn ? ` · Wdn ${stats.withdrawn}` : ""}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Revenue
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-gold">
              {formatCurrency(stats.revenue, sym)}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Invoices
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-navy">
              {stats.invTotal}
            </p>
            <p className="mt-1 text-xs text-muted">
              Paid {stats.invPaid} · Unpaid {stats.invUnpaid}
            </p>
          </Card>
        </div>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
          Recent sales
        </h2>
        {!recentSales || recentSales.length === 0 ? (
          <p className="text-sm text-muted">No sales recorded yet.</p>
        ) : (
          <ul className="divide-y divide-navy/10 rounded-xl border border-navy/10 bg-white">
            {recentSales.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
              >
                <span className="font-mono font-medium text-navy">
                  Lot {s.displayLotNumber}
                </span>
                <span className="text-ink">{s.description}</span>
                <span className="font-mono text-gold">
                  {formatCurrency(s.amount, sym)}
                </span>
                <span className="font-mono text-muted">
                  Paddle #{s.paddleNumber}
                </span>
                <span className="text-muted">Qty {s.quantity}</span>
                <span className="font-mono text-xs text-muted">
                  {s.clerkInitials} · {formatDateTime(s.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
