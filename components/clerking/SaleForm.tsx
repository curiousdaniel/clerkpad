"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { displayLotNumberFromParts } from "@/lib/utils/lotSuffix";
import { parseLotDisplay } from "@/lib/clerking/lotParse";
import {
  computeNewPassOutLotSuffix,
  nextPassOutLineDisplay,
} from "@/lib/clerking/passOutDb";
import { getNextSuggestedLotDisplay } from "@/lib/clerking/nextBaseLot";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { PassOutCheckbox } from "./PassOutCheckbox";
import { useToast } from "@/components/providers/ToastProvider";
import { formatCurrency } from "@/lib/utils/formatCurrency";
import { roundMoney } from "@/lib/services/invoiceLogic";

const CLERK_KEY = "clerkbid:clerkInitials";

type UndoState = { saleId: number; lotId: number; until: number };

export function SaleForm({
  eventId,
  currencySymbol,
  buyersPremiumRate = 0,
}: {
  eventId: number;
  currencySymbol: string;
  buyersPremiumRate?: number;
}) {
  const { db } = useUserDb();
  const { showToast } = useToast();
  const [lotNumber, setLotNumber] = useState("");
  const [title, setTitle] = useState("");
  const [consignor, setConsignor] = useState("");
  const [lotNotes, setLotNotes] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellPrice, setSellPrice] = useState("");
  const [paddleNumber, setPaddleNumber] = useState("");
  const [clerkInitials, setClerkInitials] = useState("");
  const [passOutEnabled, setPassOutEnabled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  const lotRef = useRef<HTMLInputElement>(null);
  const paddleRef = useRef<HTMLInputElement>(null);

  const refreshLotSuggestion = useCallback(async () => {
    if (!db) return;
    const next = await getNextSuggestedLotDisplay(db, eventId);
    setLotNumber(next);
  }, [db, eventId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let initials = "";
      try {
        initials = sessionStorage.getItem(CLERK_KEY) ?? "";
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      setClerkInitials(initials);
      await refreshLotSuggestion();
      setTitle("");
      setConsignor("");
      setLotNotes("");
      setQuantity("1");
      setSellPrice("");
      setPaddleNumber("");
      setPassOutEnabled(false);
      setFormError(null);
      setUndoState(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, refreshLotSuggestion]);

  useEffect(() => {
    if (!undoState) return;
    const id = window.setInterval(() => {
      if (Date.now() > undoState.until) setUndoState(null);
    }, 500);
    return () => clearInterval(id);
  }, [undoState]);

  const priceRaw = sellPrice.trim().replace(/[^0-9.-]/g, "");
  const hammerPreview = parseFloat(priceRaw);
  const bpPreview =
    buyersPremiumRate > 0 &&
    Number.isFinite(hammerPreview) &&
    hammerPreview >= 0
      ? roundMoney(hammerPreview * (1 + buyersPremiumRate))
      : null;

  async function autofillFromLot() {
    if (!db) return;
    const parsed = parseLotDisplay(lotNumber);
    if (!parsed) return;
    const display = displayLotNumberFromParts(parsed.base, parsed.suffix);
    const lot = await db.lots
      .where("[eventId+displayLotNumber]")
      .equals([eventId, display])
      .first();
    if (lot) {
      setTitle(lot.description);
      setConsignor(lot.consignor ?? "");
      setQuantity(String(lot.quantity));
      setLotNotes(lot.notes ?? "");
    }
  }

  async function resetAfterEscape() {
    setPassOutEnabled(false);
    setFormError(null);
    setTitle("");
    setConsignor("");
    setLotNotes("");
    setQuantity("1");
    setSellPrice("");
    setPaddleNumber("");
    await refreshLotSuggestion();
    requestAnimationFrame(() => lotRef.current?.focus());
  }

  async function undoLastSale() {
    if (!db || !undoState || Date.now() > undoState.until) return;
    const { saleId, lotId } = undoState;
    try {
      await db.transaction("rw", [db.sales, db.lots], async () => {
        const sale = await db.sales.get(saleId);
        if (!sale || sale.eventId !== eventId || sale.lotId !== lotId) {
          throw new Error("Sale no longer available to undo.");
        }
        const lot = await db.lots.get(lotId);
        if (!lot || lot.eventId !== eventId) {
          throw new Error("Lot no longer available to undo.");
        }
        const salesOnLot = await db.sales
          .where("lotId")
          .equals(lotId)
          .count();
        if (salesOnLot !== 1) {
          throw new Error("Cannot undo — lot has multiple sales.");
        }
        await db.sales.delete(saleId);
        await db.lots.delete(lotId);
      });
      setUndoState(null);
      showToast({ kind: "success", message: "Last sale undone." });
      await refreshLotSuggestion();
      requestAnimationFrame(() => lotRef.current?.focus());
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Undo failed.",
      });
    }
  }

  async function submitSale(shiftEnter: boolean) {
    if (!db) return;
    setFormError(null);
    setUndoState(null);
    const passOutActive = passOutEnabled || shiftEnter;
    if (shiftEnter) {
      setPassOutEnabled(true);
    }

    const parsed = parseLotDisplay(lotNumber);
    if (!parsed) {
      setFormError("Enter a valid lot number (e.g. 0001 or 0001A).");
      return;
    }

    const titleTrim = title.trim();
    if (!titleTrim) {
      setFormError("Description / title is required.");
      return;
    }

    const priceRawInner = sellPrice.trim().replace(/[^0-9.-]/g, "");
    const amount = parseFloat(priceRawInner);
    if (!Number.isFinite(amount) || amount < 0) {
      setFormError("Enter a valid sell price.");
      return;
    }

    const paddle = parseInt(paddleNumber.trim(), 10);
    if (!Number.isFinite(paddle) || paddle < 1) {
      setFormError("Enter a valid paddle number.");
      return;
    }

    const bidder = await db.bidders
      .where("[eventId+paddleNumber]")
      .equals([eventId, paddle])
      .first();
    if (bidder?.id == null) {
      setFormError(`No bidder registered with paddle #${paddle}.`);
      return;
    }

    const initials = clerkInitials.trim().toUpperCase().slice(0, 3);
    if (initials.length < 2) {
      setFormError("Clerk initials are required (2–3 characters).");
      return;
    }

    if (!passOutActive && parsed.suffix) {
      setFormError(
        "Lot has a letter suffix — enable pass out, or use a base lot number only."
      );
      return;
    }

    const baseNum = parsed.base;
    const newSuffix = passOutActive
      ? await computeNewPassOutLotSuffix(db, eventId, baseNum)
      : "";
    const displayStr = displayLotNumberFromParts(baseNum, newSuffix);

    const dupe = await db.lots
      .where("[eventId+displayLotNumber]")
      .equals([eventId, displayStr])
      .count();
    if (dupe > 0) {
      setFormError(`Lot ${displayStr} already exists for this event.`);
      return;
    }

    const qty = Math.max(1, parseInt(quantity.trim(), 10) || 1);
    const now = new Date();
    const notesTrim = lotNotes.trim();

    let newLotId = 0;
    let newSaleId = 0;

    try {
      await db.transaction("rw", [db.lots, db.sales], async () => {
        newLotId = (await db.lots.add({
          eventId,
          baseLotNumber: baseNum,
          lotSuffix: newSuffix,
          displayLotNumber: displayStr,
          description: titleTrim,
          consignor: consignor.trim() || undefined,
          notes: notesTrim || undefined,
          quantity: qty,
          status: "sold",
          createdAt: now,
          updatedAt: now,
        })) as number;
        newSaleId = (await db.sales.add({
          eventId,
          lotId: newLotId,
          bidderId: bidder.id!,
          displayLotNumber: displayStr,
          paddleNumber: paddle,
          description: titleTrim,
          consignor: consignor.trim() || undefined,
          quantity: qty,
          amount,
          clerkInitials: initials,
          createdAt: now,
        })) as number;
      });
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Could not record sale (duplicate?)."
      );
      return;
    }

    setUndoState({
      saleId: newSaleId,
      lotId: newLotId,
      until: Date.now() + 120_000,
    });

    try {
      sessionStorage.setItem(CLERK_KEY, initials);
    } catch {
      /* ignore */
    }

    showToast({ kind: "success", message: `Sale recorded — ${displayStr}` });

    if (passOutActive) {
      setPaddleNumber("");
      setLotNotes("");
      const nextDisp = await nextPassOutLineDisplay(db, eventId, baseNum);
      setLotNumber(nextDisp);
      requestAnimationFrame(() => paddleRef.current?.focus());
    } else {
      setPassOutEnabled(false);
      setTitle("");
      setConsignor("");
      setLotNotes("");
      setQuantity("1");
      setSellPrice("");
      setPaddleNumber("");
      await refreshLotSuggestion();
      requestAnimationFrame(() => lotRef.current?.focus());
    }
  }

  const undoSecondsLeft = undoState
    ? Math.max(0, Math.ceil((undoState.until - Date.now()) / 1000))
    : 0;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submitSale(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          void resetAfterEscape();
          return;
        }
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          void submitSale(true);
        }
      }}
    >
      <PassOutCheckbox
        checked={passOutEnabled}
        onChange={setPassOutEnabled}
      />

      {undoState && undoSecondsLeft > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-navy/15 bg-surface px-3 py-2 text-sm">
          <span className="text-muted">
            Undo last sale ({undoSecondsLeft}s)
          </span>
          <Button type="button" variant="secondary" onClick={() => void undoLastSale()}>
            Undo
          </Button>
        </div>
      ) : null}

      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          ref={lotRef}
          id="sale-lot"
          label="Lot number"
          value={lotNumber}
          onChange={(e) => setLotNumber(e.target.value)}
          onBlur={() => void autofillFromLot()}
          className="font-mono"
          autoComplete="off"
        />
        <div>
          <Input
            id="sale-price"
            label={`Hammer / sell price (${currencySymbol})`}
            inputMode="decimal"
            value={sellPrice}
            onChange={(e) => setSellPrice(e.target.value)}
            className="font-mono"
            autoComplete="off"
          />
          {bpPreview != null ? (
            <p className="mt-1 text-xs text-muted">
              With {Math.round(buyersPremiumRate * 100)}% buyer&apos;s premium
              (before tax):{" "}
              <span className="font-mono font-medium text-navy">
                {formatCurrency(bpPreview, currencySymbol)}
              </span>
            </p>
          ) : null}
        </div>
      </div>

      <Input
        id="sale-title"
        label="Lot description / title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoComplete="off"
      />

      <div>
        <label
          htmlFor="sale-lot-notes"
          className="mb-1 block text-sm font-medium text-ink"
        >
          Lot notes / ring (optional)
        </label>
        <textarea
          id="sale-lot-notes"
          className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
          rows={2}
          value={lotNotes}
          onChange={(e) => setLotNotes(e.target.value)}
          placeholder="Announcement line, ring notes…"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          id="sale-consignor"
          label="Consignor (optional)"
          value={consignor}
          onChange={(e) => setConsignor(e.target.value)}
          autoComplete="off"
        />
        <Input
          id="sale-qty"
          label="Quantity"
          inputMode="numeric"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          autoComplete="off"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          ref={paddleRef}
          id="sale-paddle"
          label="Paddle number"
          inputMode="numeric"
          value={paddleNumber}
          onChange={(e) => setPaddleNumber(e.target.value)}
          className="font-mono"
          autoComplete="off"
        />
        <Input
          id="sale-initials"
          label="Clerk initials"
          value={clerkInitials}
          onChange={(e) =>
            setClerkInitials(e.target.value.toUpperCase().slice(0, 3))
          }
          maxLength={3}
          className="font-mono uppercase"
          autoComplete="off"
        />
      </div>

      <p className="text-xs text-muted">
        Enter records the sale (normal or pass-out per checkbox). Tab order:
        lot → description → notes → consignor → quantity → price → paddle →
        initials, then Enter to submit.
      </p>

      <button type="submit" className="sr-only">
        Submit sale
      </button>
    </form>
  );
}
