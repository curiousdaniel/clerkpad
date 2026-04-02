"use client";

import { useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { ChevronDown, ChevronRight, Ban } from "lucide-react";
import type { Sale } from "@/lib/db";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { parseLotDisplay } from "@/lib/clerking/lotParse";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { formatDateTime } from "@/lib/utils/formatDate";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Row = Sale & { baseLot: number };

export function RecentSales({
  eventId,
  currencySymbol,
  onVoided,
}: {
  eventId: number;
  currencySymbol: string;
  onVoided?: () => void;
}) {
  const { db, ready } = useUserDb();
  const sales = useLiveQuery(
    async () => {
      if (!ready || !db) return [];
      const rows = await db.sales.where("eventId").equals(eventId).toArray();
      rows.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return rows.slice(0, 20).map((s) => {
        const p = parseLotDisplay(s.displayLotNumber);
        return {
          ...s,
          baseLot: p?.base ?? 0,
        } satisfies Row;
      });
    },
    [ready, db, eventId]
  );

  const [openId, setOpenId] = useState<number | null>(null);
  const [voidSale, setVoidSale] = useState<Sale | null>(null);

  const groups = useMemo(() => {
    if (!sales?.length) return [];
    const out: { base: number; items: Row[] }[] = [];
    for (const s of sales) {
      const last = out[out.length - 1];
      if (last && last.base === s.baseLot) {
        last.items.push(s);
      } else {
        out.push({ base: s.baseLot, items: [s] });
      }
    }
    return out;
  }, [sales]);

  async function confirmVoid() {
    if (voidSale?.id == null || voidSale.lotId == null || !db) return;
    const saleId = voidSale.id;
    const lotId = voidSale.lotId;
    setVoidSale(null);
    await db.transaction("rw", [db.lots, db.sales], async () => {
      await db.sales.delete(saleId);
      await db.lots.update(lotId, {
        status: "unsold",
        updatedAt: new Date(),
      });
    });
    onVoided?.();
  }

  if (!sales) {
    return <p className="text-sm text-muted">Loading sales…</p>;
  }

  if (sales.length === 0) {
    return (
      <p className="text-sm text-muted">No sales yet for this event.</p>
    );
  }

  return (
    <>
      <ul className="space-y-1">
        {groups.map((g) => (
          <li key={g.base}>
            <ul
              className={`rounded-lg border border-navy/10 ${
                g.items.length > 1 ? "border-l-4 border-l-gold/60 bg-amber-50/30" : "bg-white"
              }`}
            >
              {g.items.map((s) => {
                const expanded = openId === s.id;
                const hasSuffix =
                  (parseLotDisplay(s.displayLotNumber)?.suffix.length ?? 0) >
                  0;
                return (
                  <li
                    key={s.id}
                    className={`border-b border-navy/5 last:border-0 ${hasSuffix ? "pl-4" : ""}`}
                  >
                    <button
                      type="button"
                      className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-surface/80"
                      onClick={() =>
                        setOpenId(expanded ? null : (s.id as number))
                      }
                    >
                      {expanded ? (
                        <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                      ) : (
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                      )}
                      <span className="min-w-0 flex-1 font-mono text-xs leading-relaxed text-ink">
                        <span className="font-semibold text-navy">
                          Lot {s.displayLotNumber}
                        </span>
                        {" — "}
                        {s.description} —{" "}
                        <span className="text-gold">
                          {formatCurrency(s.amount, currencySymbol)}
                        </span>
                        {" — "}
                        Paddle #{s.paddleNumber} — Qty {s.quantity} —{" "}
                        {s.clerkInitials}{" "}
                        <span className="text-muted">
                          · {formatDateTime(s.createdAt)}
                        </span>
                      </span>
                    </button>
                    {expanded ? (
                      <div className="border-t border-navy/5 px-3 py-2 pl-10">
                        <Button
                          variant="danger"
                          type="button"
                          className="inline-flex items-center gap-1 text-sm"
                          onClick={() => setVoidSale(s)}
                        >
                          <Ban className="h-4 w-4" />
                          Void sale
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={voidSale != null}
        title="Void sale"
        message={
          voidSale
            ? `Remove this sale for lot ${voidSale.displayLotNumber} and mark the lot unsold?`
            : ""
        }
        confirmLabel="Void sale"
        danger
        onClose={() => setVoidSale(null)}
        onConfirm={() => void confirmVoid()}
      />
    </>
  );
}
