"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { useUserDb } from "@/components/providers/UserDbProvider";
import type { AuctionDB, Lot, Sale } from "@/lib/db";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";
import { formatConsignorDisplayLabel } from "@/lib/services/consignorCommission";
import { findLotByEventBaseAndSuffix } from "@/lib/clerking/findLotByBaseSuffix";
import {
  formatLotDisplayFromInput,
  lotDisplayBaseDigits,
  parseLotDisplay,
} from "@/lib/clerking/lotParse";
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
import {
  readSuggestNextLot,
  subscribeSuggestNextLot,
  writeSuggestNextLot,
} from "@/lib/clerkFormPrefs";
import {
  DEFAULT_SALE_FIELD_ORDER,
  isNarrowSaleField,
  readSaleFieldOrder,
  SALE_FIELD_ORDER_CHANGED,
  type SaleFieldId,
  tabOrderHelpFragment,
} from "@/lib/saleFormOrder";

const CLERK_KEY = "clerkbid:clerkInitials";

type UndoMode = "createdLot" | "reusedUnsold" | "resold";

type LotUndoSlice = Pick<
  Lot,
  "description" | "consignor" | "consignorId" | "notes" | "quantity" | "status"
>;

type SaleUndoSlice = Pick<
  Sale,
  | "bidderId"
  | "displayLotNumber"
  | "paddleNumber"
  | "description"
  | "consignor"
  | "consignorId"
  | "quantity"
  | "amount"
  | "clerkInitials"
  | "createdAt"
>;

type UndoState = {
  saleId: number;
  lotId: number;
  until: number;
  mode: UndoMode;
  restoredLot?: LotUndoSlice;
  restoredSale?: SaleUndoSlice;
};

function subscribeSaleFieldOrder(onStoreChange: () => void) {
  const fn = () => onStoreChange();
  if (typeof window !== "undefined") {
    window.addEventListener(SALE_FIELD_ORDER_CHANGED, fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener(SALE_FIELD_ORDER_CHANGED, fn);
      window.removeEventListener("storage", fn);
    };
  }
  return () => {};
}

async function patchLotWithConsignor(
  db: AuctionDB,
  lotId: number,
  patch: Pick<
    Lot,
    "description" | "consignor" | "notes" | "quantity" | "status" | "updatedAt"
  >,
  consignorId: number | null
): Promise<void> {
  const cur = await db.lots.get(lotId);
  if (!cur) return;
  const next: Lot = { ...cur, ...patch };
  if (consignorId != null) next.consignorId = consignorId;
  else delete next.consignorId;
  await db.lots.put(next);
}

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
  const [linkedConsignorId, setLinkedConsignorId] = useState<number | null>(
    null
  );
  const [lotNotes, setLotNotes] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [sellPrice, setSellPrice] = useState("");
  const [paddleNumber, setPaddleNumber] = useState("");
  const [clerkInitials, setClerkInitials] = useState("");
  const [passOutEnabled, setPassOutEnabled] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);

  const fieldRefs = useRef<Partial<Record<SaleFieldId, HTMLElement | null>>>(
    {}
  );

  const fieldOrder = useSyncExternalStore(
    subscribeSaleFieldOrder,
    readSaleFieldOrder,
    () => DEFAULT_SALE_FIELD_ORDER
  );

  const suggestNextLotEnabled = useSyncExternalStore(
    subscribeSuggestNextLot,
    readSuggestNextLot,
    () => true
  );

  const consignors = useLiveQuery(
    async () =>
      liveQueryGuard("saleForm.consignors", async () => {
        if (!db) return [];
        return db.consignors
          .where("eventId")
          .equals(eventId)
          .sortBy("consignorNumber");
      }, []),
    [db, eventId]
  );

  const focusField = useCallback((id: SaleFieldId) => {
    const el = fieldRefs.current[id];
    requestAnimationFrame(() => el?.focus());
  }, []);

  const refreshLotSuggestion = useCallback(
    async (afterSoldDisplay?: string) => {
      if (!readSuggestNextLot()) {
        setLotNumber("");
        return;
      }
      if (!db) return;
      const next = await getNextSuggestedLotDisplay(
        db,
        eventId,
        afterSoldDisplay ? { afterSoldDisplay } : undefined
      );
      setLotNumber(next);
    },
    [db, eventId]
  );

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
      setLinkedConsignorId(null);
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
  const unitHammerPreview = parseFloat(priceRaw);
  const qtyPreview = Math.max(1, parseInt(quantity.trim(), 10) || 1);
  const lineHammerPreview =
    Number.isFinite(unitHammerPreview) && unitHammerPreview >= 0
      ? roundMoney(unitHammerPreview * qtyPreview)
      : NaN;
  const bpPreview =
    buyersPremiumRate > 0 &&
    Number.isFinite(lineHammerPreview) &&
    lineHammerPreview >= 0
      ? roundMoney(lineHammerPreview * (1 + buyersPremiumRate))
      : null;

  async function autofillFromLot() {
    if (!db) return;
    const parsed = parseLotDisplay(lotNumber);
    if (!parsed) return;
    const lot = await findLotByEventBaseAndSuffix(
      db,
      eventId,
      parsed.base,
      parsed.suffix
    );
    if (lot) {
      setTitle(lot.description);
      setQuantity(String(lot.quantity));
      setLotNotes(lot.notes ?? "");
      if (lot.consignorId != null) {
        const c = await db.consignors.get(lot.consignorId);
        if (c) {
          setLinkedConsignorId(c.id!);
          setConsignor(formatConsignorDisplayLabel(c));
        } else {
          setLinkedConsignorId(null);
          setConsignor(lot.consignor ?? "");
        }
      } else {
        setLinkedConsignorId(null);
        setConsignor(lot.consignor ?? "");
      }
    }
  }

  async function resetAfterEscape() {
    setPassOutEnabled(false);
    setFormError(null);
    setTitle("");
    setConsignor("");
    setLinkedConsignorId(null);
    setLotNotes("");
    setQuantity("1");
    setSellPrice("");
    setPaddleNumber("");
    await refreshLotSuggestion();
    focusField("lot");
  }

  async function undoLastSale() {
    if (!db || !undoState || Date.now() > undoState.until) return;
    const { saleId, lotId, mode, restoredLot, restoredSale } = undoState;
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

        if (mode === "createdLot") {
          const salesOnLot = await db.sales
            .where("lotId")
            .equals(lotId)
            .count();
          if (salesOnLot !== 1) {
            throw new Error("Cannot undo — lot has multiple sales.");
          }
          await db.sales.delete(saleId);
          await db.lots.delete(lotId);
          return;
        }

        if (mode === "reusedUnsold") {
          if (!restoredLot) {
            throw new Error("Cannot undo — missing restore snapshot.");
          }
          await db.sales.delete(saleId);
          const curLot = await db.lots.get(lotId);
          if (curLot) {
            const next: Lot = {
              ...curLot,
              ...restoredLot,
              updatedAt: new Date(),
            };
            if (restoredLot.consignorId == null) delete next.consignorId;
            await db.lots.put(next);
          }
          return;
        }

        if (mode === "resold") {
          if (!restoredLot || !restoredSale) {
            throw new Error("Cannot undo — missing restore snapshot.");
          }
          const curS = await db.sales.get(saleId);
          if (curS) {
            const nextS: Sale = { ...curS, ...restoredSale };
            if (restoredSale.consignorId == null) delete nextS.consignorId;
            await db.sales.put(nextS);
          }
          const curLot = await db.lots.get(lotId);
          if (curLot) {
            const next: Lot = {
              ...curLot,
              ...restoredLot,
              updatedAt: new Date(),
            };
            if (restoredLot.consignorId == null) delete next.consignorId;
            await db.lots.put(next);
          }
        }
      });
      setUndoState(null);
      showToast({ kind: "success", message: "Last sale undone." });
      await refreshLotSuggestion();
      focusField("lot");
    } catch (e) {
      showToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Undo failed.",
      });
    }
  }

  async function passLotNoSale() {
    if (!db) return;
    setFormError(null);
    setUndoState(null);

    const parsed = parseLotDisplay(lotNumber);
    if (!parsed) {
      setFormError("Enter a valid lot number to pass (e.g. 1 or 1A).");
      return;
    }

    const initials = clerkInitials.trim().toUpperCase().slice(0, 3);
    if (initials.length < 2) {
      setFormError("Clerk initials are required (2–3 characters).");
      return;
    }

    const existingLot = await findLotByEventBaseAndSuffix(
      db,
      eventId,
      parsed.base,
      parsed.suffix
    );

    if (existingLot?.id == null) {
      setFormError(
        "No catalog lot matches that number. Import or add the lot first."
      );
      return;
    }

    if (existingLot.status === "withdrawn") {
      setFormError("Cannot pass — lot is withdrawn.");
      return;
    }

    if (existingLot.status === "sold") {
      setFormError("Cannot pass — lot is already marked sold.");
      return;
    }

    const salesCount = await db.sales
      .where("lotId")
      .equals(existingLot.id)
      .count();
    if (salesCount > 0) {
      setFormError("Cannot pass — this lot has a sale recorded.");
      return;
    }

    const displayStr =
      formatLotDisplayFromInput(lotNumber) ?? existingLot.displayLotNumber;
    const titleTrim = title.trim();
    const notesTrim = lotNotes.trim();
    const consignorTrim = consignor.trim();
    const qty = Math.max(1, parseInt(quantity.trim(), 10) || 1);
    const now = new Date();

    await patchLotWithConsignor(
      db,
      existingLot.id,
      {
        status: "passed",
        description: titleTrim || existingLot.description,
        consignor: consignorTrim || undefined,
        notes: notesTrim || undefined,
        quantity: qty,
        updatedAt: now,
      },
      linkedConsignorId
    );

    try {
      sessionStorage.setItem(CLERK_KEY, initials);
    } catch {
      /* ignore */
    }

    showToast({
      kind: "success",
      message: `Lot ${displayStr} marked passed (no sale).`,
    });

    setPassOutEnabled(false);
    setTitle("");
    setConsignor("");
    setLinkedConsignorId(null);
    setLotNotes("");
    setQuantity("1");
    setSellPrice("");
    setPaddleNumber("");

    await refreshLotSuggestion(displayStr);
    focusField("lot");
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
      setFormError("Enter a valid lot number (e.g. 1 or 1A).");
      return;
    }

    const titleTrim = title.trim();
    if (!titleTrim) {
      setFormError("Description / title is required.");
      return;
    }

    const priceRawInner = sellPrice.trim().replace(/[^0-9.-]/g, "");
    const unitHammer = parseFloat(priceRawInner);
    if (!Number.isFinite(unitHammer) || unitHammer < 0) {
      setFormError("Enter a valid hammer price per unit.");
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
    const baseDigits = lotDisplayBaseDigits(lotNumber) ?? String(baseNum);
    const displayStr = passOutActive
      ? baseDigits + newSuffix
      : formatLotDisplayFromInput(lotNumber) ?? baseDigits;

    const existingLot = await findLotByEventBaseAndSuffix(
      db,
      eventId,
      baseNum,
      newSuffix
    );

    const qty = Math.max(1, parseInt(quantity.trim(), 10) || 1);
    const now = new Date();
    const notesTrim = lotNotes.trim();
    const consignorTrim = consignor.trim() || undefined;

    const lotMarkSold: Pick<
      Lot,
      "description" | "consignor" | "notes" | "quantity" | "status" | "updatedAt"
    > = {
      description: titleTrim,
      consignor: consignorTrim,
      notes: notesTrim || undefined,
      quantity: qty,
      status: "sold" as const,
      updatedAt: now,
    };

    const bidderId = bidder.id!;

    const lineHammer = roundMoney(unitHammer * qty);

    function buildSaleRow(lotId: number): Omit<Sale, "id"> {
      const row: Omit<Sale, "id"> = {
        eventId,
        lotId,
        bidderId,
        displayLotNumber: displayStr,
        paddleNumber: paddle,
        description: titleTrim,
        consignor: consignorTrim,
        quantity: qty,
        amount: lineHammer,
        clerkInitials: initials,
        createdAt: now,
      };
      if (linkedConsignorId != null) row.consignorId = linkedConsignorId;
      return row;
    }

    let nextUndo: UndoState;

    try {
      if (!existingLot) {
        let newLotId = 0;
        let newSaleId = 0;
        await db.transaction("rw", [db.lots, db.sales], async () => {
          const newLotRow: Omit<Lot, "id"> = {
            eventId,
            baseLotNumber: baseNum,
            lotSuffix: newSuffix,
            displayLotNumber: displayStr,
            ...lotMarkSold,
            createdAt: now,
          };
          if (linkedConsignorId != null) newLotRow.consignorId = linkedConsignorId;
          newLotId = (await db.lots.add(newLotRow)) as number;
          newSaleId = (await db.sales.add(buildSaleRow(newLotId))) as number;
        });
        nextUndo = {
          mode: "createdLot",
          saleId: newSaleId,
          lotId: newLotId,
          until: Date.now() + 120_000,
        };
      } else {
        const lotId = existingLot.id!;
        const salesOnLot = await db.sales
          .where("lotId")
          .equals(lotId)
          .toArray();

        const openCatalog =
          (existingLot.status === "unsold" || existingLot.status === "passed") &&
          salesOnLot.length === 0;

        if (!openCatalog) {
          if (salesOnLot.length > 1) {
            setFormError(
              "This lot has multiple sales; resolve outside the clerk form before continuing."
            );
            return;
          }
          if (
            !window.confirm(
              `Lot ${displayStr} already has a sale or is not an open catalog lot. OK to replace the stored sale and lot details with this form?`
            )
          ) {
            return;
          }
        }

        const restoredLot: LotUndoSlice = {
          description: existingLot.description,
          consignor: existingLot.consignor,
          consignorId: existingLot.consignorId,
          notes: existingLot.notes,
          quantity: existingLot.quantity,
          status: existingLot.status,
        };

        if (openCatalog) {
          let newSaleId = 0;
          await db.transaction("rw", [db.lots, db.sales], async () => {
            await patchLotWithConsignor(
              db,
              lotId,
              lotMarkSold,
              linkedConsignorId
            );
            newSaleId = (await db.sales.add(buildSaleRow(lotId))) as number;
          });
          nextUndo = {
            mode: "reusedUnsold",
            saleId: newSaleId,
            lotId,
            until: Date.now() + 120_000,
            restoredLot,
          };
        } else if (salesOnLot.length === 1) {
          const prevSale = salesOnLot[0]!;
          const restoredSale: SaleUndoSlice = {
            bidderId: prevSale.bidderId,
            displayLotNumber: prevSale.displayLotNumber,
            paddleNumber: prevSale.paddleNumber,
            description: prevSale.description,
            consignor: prevSale.consignor,
            consignorId: prevSale.consignorId,
            quantity: prevSale.quantity,
            amount: prevSale.amount,
            clerkInitials: prevSale.clerkInitials,
            createdAt: prevSale.createdAt,
          };
          await db.transaction("rw", [db.lots, db.sales], async () => {
            await patchLotWithConsignor(
              db,
              lotId,
              lotMarkSold,
              linkedConsignorId
            );
            const salePatch = buildSaleRow(lotId);
            const curS = await db.sales.get(prevSale.id!);
            if (curS) {
              const nextS: Sale = { ...curS, ...salePatch };
              if (linkedConsignorId == null) delete nextS.consignorId;
              await db.sales.put(nextS);
            }
          });
          nextUndo = {
            mode: "resold",
            saleId: prevSale.id!,
            lotId,
            until: Date.now() + 120_000,
            restoredLot,
            restoredSale,
          };
        } else {
          let newSaleId = 0;
          await db.transaction("rw", [db.lots, db.sales], async () => {
            await patchLotWithConsignor(
              db,
              lotId,
              lotMarkSold,
              linkedConsignorId
            );
            newSaleId = (await db.sales.add(buildSaleRow(lotId))) as number;
          });
          nextUndo = {
            mode: "reusedUnsold",
            saleId: newSaleId,
            lotId,
            until: Date.now() + 120_000,
            restoredLot,
          };
        }
      }
    } catch (e) {
      setFormError(
        e instanceof Error ? e.message : "Could not record sale (duplicate?)."
      );
      return;
    }

    setUndoState(nextUndo);

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
      focusField("paddle");
    } else {
      setPassOutEnabled(false);
      setTitle("");
      setConsignor("");
      setLinkedConsignorId(null);
      setLotNotes("");
      setQuantity("1");
      setSellPrice("");
      setPaddleNumber("");
      await refreshLotSuggestion(displayStr);
      focusField("lot");
    }
  }

  const undoSecondsLeft = undoState
    ? Math.max(0, Math.ceil((undoState.until - Date.now()) / 1000))
    : 0;

  const setRef =
    (id: SaleFieldId) => (el: HTMLElement | null) => {
      fieldRefs.current[id] = el;
    };

  function renderField(id: SaleFieldId) {
    switch (id) {
      case "lot":
        return (
          <Input
            key="lot"
            ref={(el) => {
              setRef("lot")(el);
            }}
            id="sale-lot"
            label="Lot number"
            value={lotNumber}
            onChange={(e) => setLotNumber(e.target.value)}
            onBlur={() => void autofillFromLot()}
            className="font-mono"
            autoComplete="off"
          />
        );
      case "price":
        return (
          <div key="price">
            <Input
              ref={(el) => {
                setRef("price")(el);
              }}
              id="sale-price"
              label={`Hammer per unit (${currencySymbol})`}
              inputMode="decimal"
              value={sellPrice}
              onChange={(e) => setSellPrice(e.target.value)}
              className="font-mono"
              autoComplete="off"
            />
            {Number.isFinite(lineHammerPreview) && qtyPreview > 1 ? (
              <p className="mt-1 text-xs text-muted">
                Line hammer ({qtyPreview} ×{" "}
                {formatCurrency(unitHammerPreview, currencySymbol)}):{" "}
                <span className="font-mono font-medium text-navy dark:text-slate-200">
                  {formatCurrency(lineHammerPreview, currencySymbol)}
                </span>
              </p>
            ) : null}
            {bpPreview != null ? (
              <p className="mt-1 text-xs text-muted">
                With {Math.round(buyersPremiumRate * 100)}% buyer&apos;s premium
                (before tax), line:{" "}
                <span className="font-mono font-medium text-navy dark:text-slate-200">
                  {formatCurrency(bpPreview, currencySymbol)}
                </span>
              </p>
            ) : null}
          </div>
        );
      case "paddle":
        return (
          <Input
            key="paddle"
            ref={(el) => {
              setRef("paddle")(el);
            }}
            id="sale-paddle"
            label="Paddle number"
            inputMode="numeric"
            value={paddleNumber}
            onChange={(e) => setPaddleNumber(e.target.value)}
            className="font-mono"
            autoComplete="off"
          />
        );
      case "quantity":
        return (
          <Input
            key="quantity"
            ref={(el) => {
              setRef("quantity")(el);
            }}
            id="sale-qty"
            label="Quantity"
            inputMode="numeric"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoComplete="off"
          />
        );
      case "description":
        return (
          <Input
            key="description"
            ref={(el) => {
              setRef("description")(el);
            }}
            id="sale-title"
            label="Lot description / title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoComplete="off"
          />
        );
      case "notes":
        return (
          <div key="notes">
            <label
              htmlFor="sale-lot-notes"
              className="mb-1 block text-sm font-medium text-ink"
            >
              Lot notes / ring (optional)
            </label>
            <textarea
              ref={(el) => {
                setRef("notes")(el);
              }}
              id="sale-lot-notes"
              className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
              rows={2}
              value={lotNotes}
              onChange={(e) => setLotNotes(e.target.value)}
              placeholder="Announcement line, ring notes…"
            />
          </div>
        );
      case "consignor":
        return (
          <div key="consignor" className="space-y-2">
            <div>
              <label
                htmlFor="sale-consignor-registry"
                className="mb-1 block text-sm font-medium text-ink dark:text-slate-100"
              >
                Registered consignor
              </label>
              <select
                id="sale-consignor-registry"
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
              ref={(el) => {
                setRef("consignor")(el);
              }}
              id="sale-consignor"
              label="Consignor label (optional)"
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
              autoComplete="off"
            />
          </div>
        );
      case "initials":
        return (
          <Input
            key="initials"
            ref={(el) => {
              setRef("initials")(el);
            }}
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
        );
      default:
        return null;
    }
  }

  function renderLayoutGroups(): ReactNode[] {
    const rows: ReactNode[] = [];
    let i = 0;
    while (i < fieldOrder.length) {
      const id = fieldOrder[i]!;
      if (!isNarrowSaleField(id)) {
        rows.push(
          <div key={`sale-row-${i}-${id}`}>{renderField(id)}</div>
        );
        i += 1;
        continue;
      }
      const next = fieldOrder[i + 1];
      if (next != null && isNarrowSaleField(next)) {
        rows.push(
          <div
            key={`sale-row-${i}-${id}-${next}`}
            className="grid gap-4 sm:grid-cols-2"
          >
            {renderField(id)}
            {renderField(next)}
          </div>
        );
        i += 2;
      } else {
        rows.push(
          <div key={`sale-row-${i}-${id}`}>{renderField(id)}</div>
        );
        i += 1;
      }
    }
    return rows;
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
      {formError ? (
        <p className="text-sm text-danger" role="alert">
          {formError}
        </p>
      ) : null}

      {renderLayoutGroups()}

      <label className="flex cursor-pointer flex-wrap items-center gap-2 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={suggestNextLotEnabled}
          onChange={(e) => {
            const on = e.target.checked;
            writeSuggestNextLot(on);
            if (!on) {
              setLotNumber("");
              return;
            }
            if (db) {
              void getNextSuggestedLotDisplay(db, eventId).then(setLotNumber);
            }
          }}
          className="h-4 w-4 rounded border-navy/30 text-navy focus:ring-navy"
        />
        <span>Suggest next lot number after each sale</span>
        <span className="text-xs font-normal text-muted">
          When off, the lot field stays empty after reset, sale, or undo (pass-out
          line still advances automatically).
        </span>
      </label>

      <PassOutCheckbox
        checked={passOutEnabled}
        onChange={setPassOutEnabled}
      />

      <div className="space-y-1">
        <Button
          type="submit"
          variant="primary"
          className="w-full py-3 text-base font-semibold sm:py-2.5"
        >
          Record sale
        </Button>
        <p className="text-center text-xs text-muted sm:text-left">
          Same as pressing Enter — use after lot, price, paddle, and initials
          are filled (and pass-out if needed).
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Button type="button" variant="secondary" onClick={() => void passLotNoSale()}>
          Pass lot (no sale)
        </Button>
        <p className="max-w-xl text-xs text-muted">
          Marks this catalog lot as passed when it does not sell. Passed lots are
          skipped by the next-lot suggestion. Requires clerk initials; does not
          record a sale or use hammer price / paddle.
        </p>
      </div>

      {undoState && undoSecondsLeft > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-navy/15 bg-surface px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800/60">
          <span className="text-muted">
            Undo last sale ({undoSecondsLeft}s)
          </span>
          <Button type="button" variant="secondary" onClick={() => void undoLastSale()}>
            Undo
          </Button>
        </div>
      ) : null}

      <p className="text-xs text-muted">
        <span className="sm:hidden">
          Use <strong className="font-medium text-ink dark:text-slate-200">
            Record sale
          </strong>{" "}
          or a keyboard: Enter submits (normal or pass-out per checkbox).
        </span>
        <span className="hidden sm:inline">
          Enter records the sale (normal or pass-out per checkbox). Tab order:{" "}
          {tabOrderHelpFragment(fieldOrder)}, then next-lot suggestion, pass out,
          <strong className="font-medium text-ink dark:text-slate-200">
            {" "}
            Record sale
          </strong>
          , pass lot (no sale), undo (when shown), then Enter to submit.
        </span>
      </p>
    </form>
  );
}
