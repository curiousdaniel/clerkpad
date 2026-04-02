"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useLiveQuery } from "dexie-react-hooks";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { SummaryStats } from "@/components/reports/SummaryStats";
import { BidderTotals } from "@/components/reports/BidderTotals";
import { LotResults } from "@/components/reports/LotResults";
import { PaymentMethodSummary } from "@/components/reports/PaymentMethodSummary";
import { useCurrentEvent } from "@/lib/hooks/useCurrentEvent";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { useToast } from "@/components/providers/ToastProvider";
import {
  ACCOUNTING_CSV_HEADERS,
  buildAccountingCsvRows,
} from "@/lib/services/accountingCsv";
import { downloadCsv } from "@/lib/services/csvExporter";
import {
  buildBidderListPdf,
  buildRunListPdf,
  saveListPdf,
} from "@/lib/services/listPdfs";
import {
  buildBidderReportRows,
  buildLotReportRows,
  buildPaymentMethodBreakdown,
  computeEventSummary,
} from "@/lib/services/reportCalculator";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

const linkSecondary =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-navy/15 bg-surface px-4 py-2 text-sm font-medium text-ink transition hover:border-navy/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-navy focus-visible:ring-offset-2";

function slug(s: string) {
  return s.replace(/[^a-z0-9-_]+/gi, "-").slice(0, 48) || "event";
}

export default function ReportsPage() {
  const { db, ready: dbReady } = useUserDb();
  const { currentEvent, currentEventId } = useCurrentEvent();
  const { showToast } = useToast();

  const bundle = useLiveQuery(
    async () =>
      liveQueryGuard("reports.bundle", async () => {
        if (currentEventId == null || !dbReady || !db) return null;
        const [sales, lots, bidders, invoices] = await Promise.all([
          db.sales.where("eventId").equals(currentEventId).toArray(),
          db.lots.where("eventId").equals(currentEventId).toArray(),
          db.bidders.where("eventId").equals(currentEventId).toArray(),
          db.invoices.where("eventId").equals(currentEventId).toArray(),
        ]);
        return { sales, lots, bidders, invoices };
      }, null),
    [currentEventId, dbReady, db]
  );

  const summary = useMemo(() => {
    if (!bundle) return null;
    return computeEventSummary(
      bundle.sales,
      bundle.lots,
      bundle.bidders,
      bundle.invoices
    );
  }, [bundle]);

  const bidderRows = useMemo(() => {
    if (!bundle || !currentEvent) return [];
    return buildBidderReportRows(
      bundle.bidders,
      bundle.sales,
      bundle.invoices,
      currentEvent.taxRate
    );
  }, [bundle, currentEvent]);

  const lotRows = useMemo(() => {
    if (!bundle) return [];
    return buildLotReportRows(bundle.lots, bundle.sales);
  }, [bundle]);

  const paymentRows = useMemo(() => {
    if (!bundle) return [];
    return buildPaymentMethodBreakdown(bundle.invoices);
  }, [bundle]);

  const sym = currentEvent?.currencySymbol ?? "$";
  const eventSlug = currentEvent ? slug(currentEvent.name) : "event";

  if (currentEventId == null || !currentEvent) {
    return (
      <div>
        <Header
          title="Reports"
          description="Select an event for reports."
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
    <div className="space-y-12">
      <Header
        title="Reports"
        description={`Summaries, accounting CSV, list PDFs, and detail exports for ${currentEvent.name}.`}
        actions={
          <>
            <Link href="/invoices/" className={linkSecondary}>
              Invoices
            </Link>
            <Link href="/clerking/" className={linkSecondary}>
              Clerking
            </Link>
          </>
        }
      />

      {!bundle || !summary ? (
        <p className="text-muted">Loading…</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 rounded-xl border border-navy/15 bg-surface/80 p-4">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!currentEvent || !bundle) return;
                const rows = buildAccountingCsvRows(
                  currentEvent,
                  bundle.sales,
                  bundle.bidders,
                  bundle.invoices
                );
                downloadCsv(
                  `clerkbid-accounting-${eventSlug}.csv`,
                  [...ACCOUNTING_CSV_HEADERS],
                  rows
                );
                showToast({
                  kind: "success",
                  message: "Accounting CSV downloaded.",
                });
              }}
            >
              Download accounting CSV
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!currentEvent || !bundle) return;
                const doc = buildRunListPdf(currentEvent, bundle.lots);
                saveListPdf(doc, `clerkbid-run-list-${eventSlug}.pdf`);
              }}
            >
              Run list PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!currentEvent || !bundle) return;
                const doc = buildBidderListPdf(currentEvent, bundle.bidders);
                saveListPdf(doc, `clerkbid-bidders-${eventSlug}.pdf`);
              }}
            >
              Bidder list PDF
            </Button>
          </div>
          <SummaryStats stats={summary} currencySymbol={sym} />
          <PaymentMethodSummary rows={paymentRows} currencySymbol={sym} />
          <BidderTotals
            rows={bidderRows}
            currencySymbol={sym}
            eventSlug={eventSlug}
          />
          <LotResults
            rows={lotRows}
            currencySymbol={sym}
            eventSlug={eventSlug}
          />
        </>
      )}
    </div>
  );
}
