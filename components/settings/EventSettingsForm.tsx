"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import type { AuctionEvent, EventLocalBranding } from "@/lib/db";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { processInvoiceLogoFile } from "@/lib/utils/processInvoiceLogo";
import { liveQueryGuard } from "@/lib/dexie/liveQueryGuard";

export function EventSettingsForm({
  event,
  onSaved,
}: {
  event: AuctionEvent;
  onSaved: () => void;
}) {
  const { db } = useUserDb();
  const eventLogoInputRef = useRef<HTMLInputElement>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [taxRatePct, setTaxRatePct] = useState("0");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [buyersPremiumPct, setBuyersPremiumPct] = useState("0");
  const [consignorCommissionPct, setConsignorCommissionPct] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);

  const [eventFooterOverride, setEventFooterOverride] = useState("");
  const [pendingLogo, setPendingLogo] = useState<{
    blob: Blob;
    mime: string;
  } | null>(null);
  const [removeEventLogo, setRemoveEventLogo] = useState(false);

  const eventBranding = useLiveQuery(
    async () =>
      liveQueryGuard("eventSettings.branding", async () => {
        if (!db || event.id == null) return undefined;
        return db.eventLocalBranding.where("eventId").equals(event.id).first();
      }, undefined),
    [db, event.id]
  );

  useEffect(() => {
    setOrganizationName(event.organizationName);
    setTaxRatePct(
      String((event.taxRate * 100).toFixed(4).replace(/\.?0+$/, ""))
    );
    setCurrencySymbol(event.currencySymbol);
    setBuyersPremiumPct(
      String(
        ((event.buyersPremiumRate ?? 0) * 100).toFixed(2).replace(/\.?0+$/, "")
      )
    );
    setConsignorCommissionPct(
      String(
        ((event.defaultConsignorCommissionRate ?? 0) * 100)
          .toFixed(2)
          .replace(/\.?0+$/, "")
      )
    );
    setError(null);
  }, [
    event.id,
    event.organizationName,
    event.taxRate,
    event.currencySymbol,
    event.buyersPremiumRate,
    event.defaultConsignorCommissionRate,
  ]);

  useEffect(() => {
    setEventFooterOverride(eventBranding?.invoiceFooterMessage ?? "");
    setPendingLogo(null);
    setRemoveEventLogo(false);
    setBrandingError(null);
  }, [event.id, eventBranding?.invoiceFooterMessage]);

  const eventPreviewBlob = removeEventLogo
    ? null
    : pendingLogo?.blob ?? eventBranding?.invoiceLogoBlob ?? null;

  const eventPreviewUrl = useMemo(() => {
    if (!eventPreviewBlob) return null;
    return URL.createObjectURL(eventPreviewBlob);
  }, [eventPreviewBlob]);

  useEffect(() => {
    return () => {
      if (eventPreviewUrl) URL.revokeObjectURL(eventPreviewUrl);
    };
  }, [eventPreviewUrl]);

  async function onPickEventLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBrandingError(null);
    const r = await processInvoiceLogoFile(file);
    if ("error" in r) {
      setBrandingError(r.error);
      return;
    }
    setPendingLogo({ blob: r.blob, mime: r.mime });
    setRemoveEventLogo(false);
  }

  async function persistEventBranding(eventId: number) {
    if (!db) return;
    const existing = await db.eventLocalBranding
      .where("eventId")
      .equals(eventId)
      .first();
    const footerTrim = eventFooterOverride.trim();

    let logoBlob: Blob | undefined;
    let logoMime: string | undefined;
    if (pendingLogo) {
      logoBlob = pendingLogo.blob;
      logoMime = pendingLogo.mime;
    } else if (!removeEventLogo && existing?.invoiceLogoBlob) {
      logoBlob = existing.invoiceLogoBlob;
      logoMime = existing.invoiceLogoMime;
    }

    const hasLogo = !!(logoBlob && logoMime && logoBlob.size > 0);
    const hasFooter = !!footerTrim;
    if (!hasLogo && !hasFooter) {
      if (existing?.id != null) {
        await db.eventLocalBranding.delete(existing.id);
      }
      return;
    }

    const row: EventLocalBranding = { eventId };
    if (hasFooter) row.invoiceFooterMessage = footerTrim;
    if (hasLogo) {
      row.invoiceLogoBlob = logoBlob;
      row.invoiceLogoMime = logoMime;
    }

    if (existing?.id != null) {
      await db.eventLocalBranding.put({ ...row, id: existing.id });
    } else {
      await db.eventLocalBranding.add(row);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBrandingError(null);
    const org = organizationName.trim();
    if (!org) {
      setError("Organization name is required.");
      return;
    }
    const pct = Number(taxRatePct);
    if (Number.isNaN(pct) || pct < 0) {
      setError("Tax rate must be a non-negative number (percent).");
      return;
    }
    const bpPct = Number(buyersPremiumPct);
    if (Number.isNaN(bpPct) || bpPct < 0 || bpPct > 100) {
      setError("Buyer’s premium must be between 0 and 100%.");
      return;
    }
    const ccPct = Number(consignorCommissionPct);
    if (Number.isNaN(ccPct) || ccPct < 0 || ccPct > 100) {
      setError("Default consignor commission must be between 0 and 100%.");
      return;
    }
    if (event.id == null || !db) return;
    await db.events.update(event.id, {
      organizationName: org,
      taxRate: pct / 100,
      buyersPremiumRate: bpPct / 100,
      defaultConsignorCommissionRate: ccPct / 100,
      currencySymbol: currencySymbol.trim() || "$",
      updatedAt: new Date(),
    });
    await persistEventBranding(event.id);
    setPendingLogo(null);
    setRemoveEventLogo(false);
    onSaved();
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-navy dark:text-slate-100">
        Current event settings
      </h2>
      <p className="mt-1 text-sm text-muted">
        Organization, tax, buyer&apos;s premium, default consignor commission,
        and currency apply to{" "}
        <span className="font-medium text-ink">{event.name}</span>.
      </p>
      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Input
          id="set-org"
          label="Organization name"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          required
        />
        <Input
          id="set-tax"
          label="Tax rate (%)"
          type="number"
          inputMode="decimal"
          step="0.0001"
          min={0}
          value={taxRatePct}
          onChange={(e) => setTaxRatePct(e.target.value)}
        />
        <Input
          id="set-bp"
          label="Buyer’s premium (%)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          max={100}
          value={buyersPremiumPct}
          onChange={(e) => setBuyersPremiumPct(e.target.value)}
        />
        <p className="text-xs text-muted">
          Percent of hammer; shown as its own line on invoices (before tax).
          Tax applies to hammer plus this premium.
        </p>
        <Input
          id="set-consignor-commission"
          label="Default consignor commission (%)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          max={100}
          value={consignorCommissionPct}
          onChange={(e) => setConsignorCommissionPct(e.target.value)}
        />
        <p className="text-xs text-muted">
          Percent of hammer retained as commission unless a consignor has an
          override. Used for statements and commission reports.
        </p>
        <Input
          id="set-currency"
          label="Currency symbol"
          value={currencySymbol}
          onChange={(e) => setCurrencySymbol(e.target.value)}
          maxLength={4}
        />

        <div className="border-t border-navy/10 pt-4 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-navy dark:text-slate-100">
            Invoice logo &amp; thank-you (this event)
          </h3>
          <p className="mt-1 text-xs text-muted">
            Optional overrides for{" "}
            <span className="font-medium text-ink">{event.name}</span> only.
            Stored on this device — not exported. Leave blank to use your
            account defaults from the Invoice appearance section on this page.
          </p>
          {brandingError ? (
            <p className="mt-2 text-sm text-danger" role="alert">
              {brandingError}
            </p>
          ) : null}
          <div className="mt-3 space-y-3">
            <div>
              <p className="mb-2 text-sm font-medium text-ink dark:text-slate-100">
                Event logo
              </p>
              <input
                ref={eventLogoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                aria-hidden
                onChange={(e) => void onPickEventLogo(e)}
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => eventLogoInputRef.current?.click()}
                >
                  Choose image
                </Button>
                {eventPreviewUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview */}
                    <img
                      src={eventPreviewUrl}
                      alt=""
                      className="h-12 max-w-[160px] rounded border border-navy/15 object-contain dark:border-slate-600"
                    />
                  </>
                ) : (
                  <span className="text-sm text-muted">No event logo.</span>
                )}
                {(eventBranding?.invoiceLogoBlob || pendingLogo) &&
                !removeEventLogo ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setRemoveEventLogo(true);
                      setPendingLogo(null);
                    }}
                  >
                    Remove event logo
                  </Button>
                ) : null}
              </div>
            </div>
            <div>
              <label
                htmlFor="event-inv-footer"
                className="mb-1 block text-sm font-medium text-ink dark:text-slate-100"
              >
                Thank-you line override
              </label>
              <textarea
                id="event-inv-footer"
                rows={2}
                className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm text-ink focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={eventFooterOverride}
                onChange={(e) => setEventFooterOverride(e.target.value)}
                placeholder="Leave empty to use account default"
              />
            </div>
          </div>
        </div>

        <Button type="submit">Save event settings</Button>
      </form>
    </Card>
  );
}
