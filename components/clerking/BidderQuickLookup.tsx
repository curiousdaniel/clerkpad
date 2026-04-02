"use client";

import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { Input } from "@/components/ui/Input";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

export function BidderQuickLookup({ eventId }: { eventId: number }) {
  const { db } = useUserDb();
  const [paddle, setPaddle] = useState("");

  const match = useLiveQuery(
    async () =>
      liveQueryGuard("bidderQuickLookup", async () => {
        if (!db) return undefined;
        const n = parseInt(paddle.trim(), 10);
        if (!Number.isFinite(n) || n < 1) return undefined;
        return db.bidders
          .where("[eventId+paddleNumber]")
          .equals([eventId, n])
          .first();
      }, undefined),
    [db, eventId, paddle]
  );

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-navy">Bidder lookup</h3>
      <Input
        id="bidder-lookup-paddle"
        label="Paddle #"
        inputMode="numeric"
        value={paddle}
        onChange={(e) => setPaddle(e.target.value)}
        className="font-mono"
        autoComplete="off"
      />
      {match ? (
        <div className="rounded-lg border border-navy/15 bg-surface px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/60">
          <p className="font-medium text-navy">
            {match.firstName} {match.lastName}
          </p>
          {match.phone ? (
            <p className="mt-1 font-mono text-xs text-muted">{match.phone}</p>
          ) : null}
          {match.email ? (
            <p className="mt-0.5 truncate text-xs text-muted">{match.email}</p>
          ) : null}
        </div>
      ) : paddle.trim() ? (
        <p className="text-xs text-muted">No bidder with that paddle.</p>
      ) : (
        <p className="text-xs text-muted">Enter a paddle to see name and contact.</p>
      )}
    </div>
  );
}
