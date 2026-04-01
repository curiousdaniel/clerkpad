"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "@/lib/db";
import { displayLotNumberFromParts } from "@/lib/utils/lotSuffix";
import { parseLotDisplay } from "@/lib/clerking/lotParse";
import {
  computeNewPassOutLotSuffix,
  nextPassOutLineDisplay,
} from "@/lib/clerking/passOutDb";
import { getNextSuggestedLotDisplay } from "@/lib/clerking/nextBaseLot";
import { Input } from "@/components/ui/Input";
import { PassOutCheckbox } from "./PassOutCheckbox";
import { useToast } from "@/components/providers/ToastProvider";

const CLERK_KEY = "clerkbid:clerkInitials";

export function SaleForm({
  eventId,
  currencySymbol,
}: {
  eventId: number;
  currencySymbol: string;
}) {
  const { showToast } = useToast();
  const [lotNumber, setLotNumber] = useState("");
  const [title, setTitle] = useState("");
  const [consignor, setConsignor] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellPrice, setSellPrice] = useState("");
  const [paddleNumber, setPaddleNumber] = useState("");
  const [clerkInitials, setClerkInitials] = useState("");
  const [passOutEnabled, setPassOutEnabled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const lotRef = useRef<HTMLInputElement>(null);
  const paddleRef = useRef<HTMLInputElement>(null);

  const refreshLotSuggestion = useCallback(async () => {
    const next = await getNextSuggestedLotDisplay(eventId);
    setLotNumber(next);
  }, [eventId]);

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
      setQuantity("1");
      setSellPrice("");
      setPaddleNumber("");
      setPassOutEnabled(false);
      setFormError(null);
    })();
    return () => {
      cancelled = true;
    };
  }, [eventId, refreshLotSuggestion]);

  async function autofillFromLot() {
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
    }
  }

  async function resetAfterEscape() {
    setPassOutEnabled(false);
    setFormError(null);
    setTitle("");
    setConsignor("");
    setQuantity("1");
    setSellPrice("");
    setPaddleNumber("");
    await refreshLotSuggestion();
    requestAnimationFrame(() => lotRef.current?.focus());
  }

  async function submitSale(shiftEnter: boolean) {
    setFormError(null);
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

    const priceRaw = sellPrice.trim().replace(/[^0-9.-]/g, "");
    const amount = parseFloat(priceRaw);
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
      ? await computeNewPassOutLotSuffix(eventId, baseNum)
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

    try {
      await db.transaction("rw", [db.lots, db.sales], async () => {
        const lotId = await db.lots.add({
          eventId,
          baseLotNumber: baseNum,
          lotSuffix: newSuffix,
          displayLotNumber: displayStr,
          description: titleTrim,
          consignor: consignor.trim() || undefined,
          quantity: qty,
          status: "sold",
          createdAt: now,
          updatedAt: now,
        });
        await db.sales.add({
          eventId,
          lotId: lotId as number,
          bidderId: bidder.id!,
          displayLotNumber: displayStr,
          paddleNumber: paddle,
          description: titleTrim,
          consignor: consignor.trim() || undefined,
          quantity: qty,
          amount,
          clerkInitials: initials,
          createdAt: now,
        });
      });
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Could not record sale (duplicate?)."
      );
      return;
    }

    try {
      sessionStorage.setItem(CLERK_KEY, initials);
    } catch {
      /* ignore */
    }

    showToast({ kind: "success", message: `Sale recorded — ${displayStr}` });

    if (passOutActive) {
      setPaddleNumber("");
      const nextDisp = await nextPassOutLineDisplay(eventId, baseNum);
      setLotNumber(nextDisp);
      requestAnimationFrame(() => paddleRef.current?.focus());
    } else {
      setPassOutEnabled(false);
      setTitle("");
      setConsignor("");
      setQuantity("1");
      setSellPrice("");
      setPaddleNumber("");
      await refreshLotSuggestion();
      requestAnimationFrame(() => lotRef.current?.focus());
    }
  }

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
        <Input
          id="sale-price"
          label={`Sell price (${currencySymbol})`}
          inputMode="decimal"
          value={sellPrice}
          onChange={(e) => setSellPrice(e.target.value)}
          className="font-mono"
          autoComplete="off"
        />
      </div>

      <Input
        id="sale-title"
        label="Lot description / title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoComplete="off"
      />

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
        lot → description → consignor → quantity → price → paddle → initials,
        then Enter to submit.
      </p>

      <button type="submit" className="sr-only">
        Submit sale
      </button>
    </form>
  );
}
