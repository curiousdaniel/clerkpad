"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  DEFAULT_SALE_FIELD_ORDER,
  readSaleFieldOrder,
  saleFieldLabel,
  writeSaleFieldOrder,
  type SaleFieldId,
} from "@/lib/saleFormOrder";

function move(arr: SaleFieldId[], index: number, delta: number): SaleFieldId[] {
  const j = index + delta;
  if (j < 0 || j >= arr.length) return arr;
  const next = [...arr];
  const t = next[index]!;
  next[index] = next[j]!;
  next[j] = t;
  return next;
}

export function SaleFormFieldOrderEditor() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SaleFieldId[]>(() => readSaleFieldOrder());
  const [savedFlash, setSavedFlash] = useState(false);

  function openEditor() {
    setDraft(readSaleFieldOrder());
    setOpen(true);
  }

  function handleSave() {
    writeSaleFieldOrder(draft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }

  function handleReset() {
    const next = [...DEFAULT_SALE_FIELD_ORDER];
    setDraft(next);
    writeSaleFieldOrder(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }

  return (
    <div className="mt-6 border-t border-navy/10 pt-4 dark:border-slate-700">
      <div className="rounded-lg border border-navy/15 bg-surface/60 dark:border-slate-600 dark:bg-slate-800/50">
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-navy transition hover:bg-white/70 dark:text-slate-100 dark:hover:bg-slate-800"
        onClick={() => (open ? setOpen(false) : openEditor())}
        aria-expanded={open}
      >
        <span>Field order (tab sequence)</span>
        <span className="text-xs font-normal text-muted">
          {open ? "Hide" : "Customize"}
        </span>
      </button>
      {open ? (
        <div className="border-t border-navy/10 px-3 pb-3 pt-2">
          <p className="text-xs text-muted">
            Order matches Tab key order in the sale form. Use Save after
            reordering. Short fields sit side by side on wider screens when they
            are next to each other in this list.
          </p>
          <ol className="mt-3 space-y-1.5">
            {draft.map((id, i) => (
              <li
                key={id}
                className="flex items-center gap-2 rounded-md border border-navy/10 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              >
                <span className="min-w-0 flex-1 truncate text-ink">
                  {saleFieldLabel(id)}
                </span>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    className="!px-2 !py-1 text-xs"
                    disabled={i === 0}
                    onClick={() => setDraft((d) => move(d, i, -1))}
                  >
                    Up
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="!px-2 !py-1 text-xs"
                    disabled={i === draft.length - 1}
                    onClick={() => setDraft((d) => move(d, i, 1))}
                  >
                    Down
                  </Button>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" onClick={handleSave}>
              Save order
            </Button>
            <Button type="button" variant="secondary" onClick={handleReset}>
              Reset to default
            </Button>
          </div>
          {savedFlash ? (
            <p className="mt-2 text-xs font-medium text-green-700">Saved.</p>
          ) : null}
        </div>
      ) : null}
      </div>
    </div>
  );
}
