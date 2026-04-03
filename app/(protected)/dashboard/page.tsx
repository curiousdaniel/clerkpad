"use client";

import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Header } from "@/components/layout/Header";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCurrentEvent } from "@/lib/hooks/useCurrentEvent";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { useCloudSync } from "@/components/providers/CloudSyncProvider";
import { ensureSettingsRow } from "@/lib/settings";
import { saleLineQuantity, saleUnitHammer } from "@/lib/services/saleLineTotals";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatDateTime } from "@/lib/utils/formatDate";
import { dateGetTime } from "@/lib/utils/coerceDate";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

function daysBetween(
  a: Date | string | undefined | null,
  b: Date | string | undefined | null
): number {
  const ta = dateGetTime(a);
  const tb = dateGetTime(b);
  if (ta == null || tb == null) return 0;
  return (tb - ta) / (86400 * 1000);
}

const linkPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white transition hover:bg-navy-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950";
const linkSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-navy/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-slate-500 dark:focus-visible:ring-offset-slate-950";

export default function DashboardPage() {
  const { db, ready: dbReady } = useUserDb();
  const { ready, currentEventId, currentEvent, refresh } = useCurrentEvent();
  const { pushNow } = useCloudSync();

  const settingsRow = useLiveQuery(
    async () =>
      liveQueryGuard("dashboard.settings", async () => {
        if (!dbReady || !db) return undefined;
        await ensureSettingsRow(db);
        return db.settings.get(1);
      }, undefined),
    [dbReady, db]
  );

  const stats = useLiveQuery(
    async () =>
      liveQueryGuard("dashboard.stats", async () => {
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
      }, null),
    [ready, dbReady, db, currentEventId]
  );

  const recentSales = useLiveQuery(
    async () =>
      liveQueryGuard("dashboard.recentSales", async () => {
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
      }, []),
    [ready, dbReady, db, currentEventId]
  );

  const sym = currentEvent?.currencySymbol ?? "$";

  const showBackupNudge =
    currentEvent != null &&
    settingsRow != null &&
    (() => {
      const dismiss = settingsRow.lastBackupNudgeDismissedAt;
      if (dismiss && daysBetween(dismiss, new Date()) < 4) return false;
      const last = currentEvent.lastCloudPushAt;
      if (!last) return true;
      return daysBetween(last, new Date()) > 7;
    })();

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
        <div className="rounded-xl border border-dashed border-navy/20 bg-surface/50 p-10 text-center dark:border-slate-600 dark:bg-slate-800/40">
          <p className="text-lg font-medium text-navy dark:text-slate-100">
            Welcome to ClerkBid
          </p>
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
      />

      {showBackupNudge && db ? (
        <div className="mb-6 rounded-xl border border-navy/15 bg-surface px-4 py-3 text-sm dark:border-slate-600 dark:bg-slate-800/60">
          <p className="font-medium text-navy dark:text-slate-100">
            Cloud backup reminder
          </p>
          <p className="mt-1 text-muted">
            You have not saved this event to the cloud recently. Sync now so
            another device—or a lost browser—does not mean lost work.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={() => void pushNow()}>
              Sync to cloud
            </Button>
            <Link href="/settings/" className={linkSecondary}>
              Backup settings
            </Link>
            <Button
              type="button"
              variant="secondary"
              onClick={async () => {
                await ensureSettingsRow(db);
                await db.settings.update(1, {
                  lastBackupNudgeDismissedAt: new Date(),
                });
                refresh();
              }}
            >
              Dismiss for a few days
            </Button>
          </div>
        </div>
      ) : null}

      {stats ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="!p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Bidders
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-navy dark:text-slate-100">
              {stats.bidderCount}
            </p>
          </Card>
          <Card className="!p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">
              Lots
            </p>
            <p className="mt-1 font-mono text-2xl font-semibold text-navy dark:text-slate-100">
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
            <p className="mt-1 font-mono text-2xl font-semibold text-navy dark:text-slate-100">
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
          <ul className="divide-y divide-navy/10 rounded-xl border border-navy/10 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
            {recentSales.map((s) => (
              <li
                key={s.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-4 py-3 text-sm"
              >
                <span className="font-mono font-medium text-navy dark:text-slate-200">
                  Lot {s.displayLotNumber}
                </span>
                <span className="text-ink dark:text-slate-100">{s.description}</span>
                <span className="font-mono text-gold">
                  {formatCurrency(s.amount, sym)}
                  {saleLineQuantity(s) > 1
                    ? ` (${formatCurrency(saleUnitHammer(s), sym)} × ${s.quantity})`
                    : ""}
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
