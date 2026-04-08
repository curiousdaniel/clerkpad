"use client";

import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { AuctionEvent, Sale } from "@/lib/db";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";
import { formatConsignorDisplayLabel } from "@/lib/services/consignorCommission";
import { persistSaleCorrection } from "@/lib/services/saleInvoiceEdits";
import { saleUnitHammer } from "@/lib/services/saleLineTotals";
import { roundMoney } from "@/lib/services/invoiceLogic";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { useCloudSync } from "@/components/providers/CloudSyncProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

type Props = {
  open: boolean;
  sale: Sale | null;
  event: AuctionEvent;
  currencySymbol: string;
  /** When set (invoice detail), sale must still belong to this invoice. */
  anchorInvoiceId?: number;
  onClose: () => void;
  onSaved: () => void;
  onError: (message: string) => void;
};

export function SaleCorrectionModal({
  open,
  sale,
  event,
  currencySymbol,
  anchorInvoiceId,
  onClose,
  onSaved,
  onError,
}: Props) {
  const { db } = useUserDb();
  const { scheduleCloudPush } = useCloudSync();
  const eventId = event.id!;
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitHammer, setUnitHammer] = useState("");
  const [paddleNumber, setPaddleNumber] = useState("");
  const [consignor, setConsignor] = useState("");
  const [linkedConsignorId, setLinkedConsignorId] = useState<number | null>(
    null
  );
  const [clerkInitials, setClerkInitials] = useState("");
  const [saving, setSaving] = useState(false);

  const bidders = useLiveQuery(
    async () =>
      liveQueryGuard("saleCorrection.bidders", async () => {
        if (!db) return [];
        return db.bidders
          .where("eventId")
          .equals(eventId)
          .sortBy("paddleNumber");
      }, []),
    [db, eventId]
  );

  const consignors = useLiveQuery(
    async () =>
      liveQueryGuard("saleCorrection.consignors", async () => {
        if (!db) return [];
        return db.consignors
          .where("eventId")
          .equals(eventId)
          .sortBy("consignorNumber");
      }, []),
    [db, eventId]
  );

  useEffect(() => {
    if (!open || !sale) return;
    setDescription(sale.description);
    setQuantity(String(sale.quantity));
    setUnitHammer(String(saleUnitHammer(sale)));
    setPaddleNumber(String(sale.paddleNumber));
    setConsignor(sale.consignor ?? "");
    setLinkedConsignorId(sale.consignorId ?? null);
    setClerkInitials(sale.clerkInitials ?? "");
  }, [open, sale]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!db || !sale?.id) return;
    const qty = Math.max(1, parseInt(quantity.trim(), 10) || 1);
    const unit = parseFloat(unitHammer.trim().replace(/[^0-9.-]/g, ""));
    if (!Number.isFinite(unit) || unit < 0) {
      onError("Enter a valid hammer price per unit.");
      return;
    }
    const amount = roundMoney(unit * qty);
    const paddle = parseInt(paddleNumber.trim(), 10);
    if (!Number.isFinite(paddle) || paddle < 1) {
      onError("Enter a valid paddle number.");
      return;
    }
    const bidder = await db.bidders
      .where("[eventId+paddleNumber]")
      .equals([eventId, paddle])
      .first();
    if (bidder?.id == null) {
      onError(`No bidder registered with paddle #${paddle}.`);
      return;
    }

    setSaving(true);
    try {
      await persistSaleCorrection(
        db,
        event,
        sale.id,
        {
          description,
          quantity: qty,
          amount,
          paddleNumber: paddle,
          bidderId: bidder.id,
          consignor: consignor.trim() || undefined,
          consignorId: linkedConsignorId,
          clerkInitials,
        },
        anchorInvoiceId != null ? { anchorInvoiceId } : undefined
      );
      scheduleCloudPush();
      onSaved();
      onClose();
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Could not save sale changes."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!sale) return null;

  return (
    <Modal
      open={open}
      title={`Correct sale — lot ${sale.displayLotNumber}`}
      onClose={onClose}
      footer={
        <>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="sale-correction-form" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <form
        id="sale-correction-form"
        className="space-y-3 text-sm"
        onSubmit={(e) => void handleSubmit(e)}
      >
        <p className="text-xs text-muted">
          Lot number is fixed to this catalog line. To move the sale to another
          bidder, change the paddle number — the line will move to that
          bidder&apos;s open unpaid invoice when you refresh or generate invoices.
          {!sale.invoiceId ? (
            <>
              {" "}
              This sale is not on an invoice yet; totals will reflect it after
              you generate or refresh invoices.
            </>
          ) : null}
        </p>
        <Input
          id="corr-desc"
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id="corr-qty"
            label="Quantity"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Input
            id="corr-unit"
            label={`Hammer per unit (${currencySymbol})`}
            inputMode="decimal"
            value={unitHammer}
            onChange={(e) => setUnitHammer(e.target.value)}
            className="font-mono"
          />
        </div>
        <Input
          id="corr-paddle"
          label="Paddle number"
          inputMode="numeric"
          value={paddleNumber}
          onChange={(e) => setPaddleNumber(e.target.value)}
          className="font-mono"
        />
        <div className="space-y-2">
          <div>
            <label
              htmlFor="corr-consignor-reg"
              className="mb-1 block text-sm font-medium text-ink dark:text-slate-200"
            >
              Registered consignor
            </label>
            <select
              id="corr-consignor-reg"
              className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={
                linkedConsignorId != null ? String(linkedConsignorId) : ""
              }
              onChange={(e) => {
                const v = e.target.value;
                if (!v) {
                  setLinkedConsignorId(null);
                  return;
                }
                const id = parseInt(v, 10);
                const c = consignors?.find((x) => x.id === id);
                if (c) {
                  setLinkedConsignorId(id);
                  setConsignor(formatConsignorDisplayLabel(c));
                }
              }}
            >
              <option value="">— None —</option>
              {(consignors ?? [])
                .filter((c) => c.id != null)
                .map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    #{c.consignorNumber} — {c.name}
                  </option>
                ))}
            </select>
          </div>
          <Input
            id="corr-consignor"
            label="Consignor label"
            value={consignor}
            onChange={(e) => {
              const v = e.target.value;
              setConsignor(v);
              if (linkedConsignorId != null) {
                const c = consignors?.find((x) => x.id === linkedConsignorId);
                if (c && v.trim() !== formatConsignorDisplayLabel(c)) {
                  setLinkedConsignorId(null);
                }
              }
            }}
          />
        </div>
        <Input
          id="corr-initials"
          label="Clerk initials"
          value={clerkInitials}
          onChange={(e) =>
            setClerkInitials(e.target.value.toUpperCase().slice(0, 3))
          }
          maxLength={3}
          className="font-mono uppercase"
        />
      </form>
    </Modal>
  );
}
