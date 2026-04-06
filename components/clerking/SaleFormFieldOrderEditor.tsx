"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  DEFAULT_SALE_FIELD_ORDER,
  DEFAULT_SALE_FIELD_REQUIRED,
  coerceRequiredAfterToggle,
  readSaleFormPrefs,
  saleFieldLabel,
  writeSaleFormPrefs,
  type SaleFieldId,
  type SaleFormPrefs,
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

function clonePrefs(p: SaleFormPrefs): SaleFormPrefs {
  return {
    order: [...p.order],
    required: { ...p.required },
  };
}

export function SaleFormFieldOrderEditor() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SaleFormPrefs>(() =>
    clonePrefs(readSaleFormPrefs())
  );
  const [savedFlash, setSavedFlash] = useState(false);

  function openEditor() {
    setDraft(clonePrefs(readSaleFormPrefs()));
    setOpen(true);
  }

  function handleSave() {
    writeSaleFormPrefs(draft);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }

  function handleReset() {
    const next: SaleFormPrefs = {
      order: [...DEFAULT_SALE_FIELD_ORDER],
      required: { ...DEFAULT_SALE_FIELD_REQUIRED },
    };
    setDraft(next);
    writeSaleFormPrefs(next);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }

  function setRequired(id: SaleFieldId, value: boolean) {
    setDraft((d) => ({
      ...d,
      required: coerceRequiredAfterToggle(id, value, d.required),
    }));
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
          <span>Field order (tab sequence) and requirements</span>
          <span className="text-xs font-normal text-muted">
            {open ? "Hide" : "Customize"}
          </span>
        </button>
        {open ? (
          <div className="border-t border-navy/10 px-3 pb-3 pt-2">
            <p className="text-xs text-muted">
              Order matches Tab key order in the sale form. Check{" "}
              <strong className="font-medium text-ink dark:text-slate-200">
                Required
              </strong>{" "}
              to block submission until the field is filled (where applicable).
              Short fields sit side by side on wider screens when they are next
              to each other in this list.
            </p>
            <p className="mt-2 text-xs text-muted">
              <strong className="font-medium text-ink dark:text-slate-200">
                Lot number
              </strong>{" "}
              or{" "}
              <strong className="font-medium text-ink dark:text-slate-200">
                description
              </strong>{" "}
              must stay required so invoices and reports have a usable line
              identity. Unchecking one turns the other on automatically.
            </p>
            <ol className="mt-3 space-y-1.5">
              {draft.order.map((id, i) => (
                <li
                  key={id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-navy/10 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                >
                  <span className="min-w-0 flex-1 truncate text-ink">
                    {saleFieldLabel(id)}
                  </span>
                  <label
                    className="flex shrink-0 cursor-pointer items-center gap-1.5 text-xs text-muted"
                    title={
                      id === "paddle"
                        ? "A winning paddle is always required to record a sale."
                        : undefined
                    }
                  >
                    <input
                      type="checkbox"
                      id={`sale-field-req-${id}`}
                      className="rounded border-navy/30"
                      checked={draft.required[id]}
                      disabled={id === "paddle"}
                      onChange={(e) => setRequired(id, e.target.checked)}
                    />
                    <span>Required</span>
                  </label>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      type="button"
                      variant="secondary"
                      className="!px-2 !py-1 text-xs"
                      disabled={i === 0}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          order: move(d.order, i, -1),
                        }))
                      }
                    >
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="!px-2 !py-1 text-xs"
                      disabled={i === draft.order.length - 1}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          order: move(d.order, i, 1),
                        }))
                      }
                    >
                      Down
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={handleSave}>
                Save
              </Button>
              <Button type="button" variant="secondary" onClick={handleReset}>
                Reset to default
              </Button>
            </div>
            {savedFlash ? (
              <p className="mt-2 text-xs font-medium text-green-700 dark:text-green-400">
                Saved.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
