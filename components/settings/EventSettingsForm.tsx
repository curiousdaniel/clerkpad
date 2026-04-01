"use client";

import { useEffect, useState } from "react";
import type { AuctionEvent } from "@/lib/db";
import { db } from "@/lib/db";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function EventSettingsForm({
  event,
  onSaved,
}: {
  event: AuctionEvent;
  onSaved: () => void;
}) {
  const [organizationName, setOrganizationName] = useState("");
  const [taxRatePct, setTaxRatePct] = useState("0");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setOrganizationName(event.organizationName);
    setTaxRatePct(
      String((event.taxRate * 100).toFixed(4).replace(/\.?0+$/, ""))
    );
    setCurrencySymbol(event.currencySymbol);
    setError(null);
  }, [event.id, event.organizationName, event.taxRate, event.currencySymbol]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
    if (event.id == null) return;
    await db.events.update(event.id, {
      organizationName: org,
      taxRate: pct / 100,
      currencySymbol: currencySymbol.trim() || "$",
      updatedAt: new Date(),
    });
    onSaved();
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-navy">Current event settings</h2>
      <p className="mt-1 text-sm text-muted">
        Organization, tax, and currency apply to invoices and reports for{" "}
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
          id="set-currency"
          label="Currency symbol"
          value={currencySymbol}
          onChange={(e) => setCurrencySymbol(e.target.value)}
          maxLength={4}
        />
        <Button type="submit">Save event settings</Button>
      </form>
    </Card>
  );
}
