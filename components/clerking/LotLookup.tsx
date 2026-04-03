"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { AuctionDB, Lot } from "@/lib/db";
import { findLotByEventBaseAndSuffix } from "@/lib/clerking/findLotByBaseSuffix";
import {
  formatLotDisplayFromInput,
  parseLotDisplay,
} from "@/lib/clerking/lotParse";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { compareLotsForReport } from "@/lib/services/reportCalculator";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

type LookupResult = { display: string; lot: Lot | undefined };

async function lookupLot(
  db: AuctionDB,
  eventId: number,
  displayRaw: string
): Promise<LookupResult | null> {
  const parsed = parseLotDisplay(displayRaw);
  if (!parsed) return null;
  const display = formatLotDisplayFromInput(displayRaw);
  if (!display) return null;
  const lot = await findLotByEventBaseAndSuffix(
    db,
    eventId,
    parsed.base,
    parsed.suffix
  );
  return { display, lot };
}

function statusTone(
  status: Lot["status"]
): "success" | "neutral" | "warning" {
  if (status === "sold") return "success";
  if (status === "unsold") return "neutral";
  return "warning";
}

export function LotLookup({ eventId }: { eventId: number }) {
  const { db, ready } = useUserDb();
  const [q, setQ] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(() => new Set());

  const allLots = useLiveQuery(
    async () =>
      liveQueryGuard("lotLookup.allLots", async () => {
        if (!ready || !db) return [];
        const rows = await db.lots.where("eventId").equals(eventId).toArray();
        return [...rows].sort(compareLotsForReport);
      }, []),
    [ready, db, eventId]
  );

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card className="!p-4">
      <h3 className="text-sm font-semibold text-navy">Lot lookup</h3>
      <p className="mt-1 text-xs text-muted">
        Enter lot # (e.g. 12 or 12A) to see status and description.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <div className="min-w-[140px] flex-1">
          <Input
            id="lot-lookup"
            label="Lot number"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="flex items-end">
          <Button
            type="button"
            onClick={async () => {
              if (!db) return;
              const r = await lookupLot(db, eventId, q);
              setResult(r);
            }}
          >
            Look up
          </Button>
        </div>
      </div>
      {result ? (
        <div className="mt-4 rounded-lg border border-navy/10 bg-surface/50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/40">
          <p className="font-mono font-semibold text-navy">{result.display}</p>
          {result.lot ? (
            <>
              <p className="mt-1 text-ink">{result.lot.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone={statusTone(result.lot.status)}>
                  {result.lot.status}
                </Badge>
                {result.lot.consignor ? (
                  <span className="text-xs text-muted">
                    Consignor: {result.lot.consignor}
                  </span>
                ) : null}
                <span className="text-xs text-muted">
                  Qty {result.lot.quantity}
                </span>
              </div>
            </>
          ) : (
            <p className="mt-1 text-muted">No lot found for this event.</p>
          )}
        </div>
      ) : null}

      <div className="mt-6 border-t border-navy/10 pt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">
          All lots in this event
        </h4>
        <p className="mt-1 text-xs text-muted">
          Scroll the list; tap a row to expand details.
        </p>
        {!allLots || allLots.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No lots yet for this event.</p>
        ) : (
          <div
            className="mt-3 max-h-[min(50vh,22rem)] overflow-y-auto overscroll-contain rounded-lg border border-navy/10 bg-white shadow-inner dark:border-slate-700 dark:bg-slate-900"
            role="region"
            aria-label="Lots in this auction"
          >
            <ul className="divide-y divide-navy/10">
              {allLots.map((lot) => {
                if (lot.id == null) return null;
                const open = expandedIds.has(lot.id);
                return (
                  <li key={lot.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-2.5 text-left transition hover:bg-navy/[0.04] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy"
                      onClick={() => toggleExpanded(lot.id!)}
                      aria-expanded={open}
                    >
                      <span className="mt-0.5 shrink-0 text-muted" aria-hidden>
                        {open ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </span>
                      <span className="shrink-0 font-mono text-sm font-semibold text-navy">
                        {lot.displayLotNumber}
                      </span>
                      <span className="shrink-0">
                        <Badge tone={statusTone(lot.status)}>
                          {lot.status}
                        </Badge>
                      </span>
                      <span
                        className={`min-w-0 flex-1 text-sm text-ink ${open ? "line-clamp-2" : "truncate"}`}
                      >
                        {lot.description}
                      </span>
                    </button>
                    {open ? (
                      <div className="border-t border-navy/5 bg-surface/60 px-3 py-3 pl-10 text-sm dark:border-slate-700 dark:bg-slate-800/50">
                        <p className="text-ink">{lot.description}</p>
                        <div className="mt-2 space-y-2 text-xs text-muted">
                          <p className="flex flex-wrap gap-x-3 gap-y-1">
                            <span>Qty {lot.quantity}</span>
                            {lot.consignor ? (
                              <span>Consignor: {lot.consignor}</span>
                            ) : null}
                          </p>
                          {lot.notes ? (
                            <div>
                              <p className="font-medium text-ink">Notes</p>
                              <p className="mt-0.5 whitespace-pre-wrap text-ink/90">
                                {lot.notes}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
