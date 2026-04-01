"use client";

import { useState } from "react";
import { db } from "@/lib/db";
import type { Lot } from "@/lib/db";
import { parseLotDisplay } from "@/lib/clerking/lotParse";
import { displayLotNumberFromParts } from "@/lib/utils/lotSuffix";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

type LookupResult = { display: string; lot: Lot | undefined };

async function lookupLot(
  eventId: number,
  displayRaw: string
): Promise<LookupResult | null> {
  const parsed = parseLotDisplay(displayRaw);
  if (!parsed) return null;
  const display = displayLotNumberFromParts(parsed.base, parsed.suffix);
  const lot = await db.lots
    .where("[eventId+displayLotNumber]")
    .equals([eventId, display])
    .first();
  return { display, lot };
}

export function LotLookup({ eventId }: { eventId: number }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<LookupResult | null>(null);

  return (
    <Card className="!p-4">
      <h3 className="text-sm font-semibold text-navy">Lot lookup</h3>
      <p className="mt-1 text-xs text-muted">
        Enter lot # (e.g. 0012 or 0012A) to see status and description.
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
              const r = await lookupLot(eventId, q);
              setResult(r);
            }}
          >
            Look up
          </Button>
        </div>
      </div>
      {result ? (
        <div className="mt-4 rounded-lg border border-navy/10 bg-surface/50 p-3 text-sm">
          <p className="font-mono font-semibold text-navy">{result.display}</p>
          {result.lot ? (
            <>
              <p className="mt-1 text-ink">{result.lot.description}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge
                  tone={
                    result.lot.status === "sold"
                      ? "success"
                      : result.lot.status === "unsold"
                        ? "neutral"
                        : "warning"
                  }
                >
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
    </Card>
  );
}
