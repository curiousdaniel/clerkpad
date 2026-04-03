"use client";

import { useEffect, useState } from "react";
import type { AuctionEvent } from "@/lib/db";
import { useUserDb } from "@/components/providers/UserDbProvider";
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
  const { db } = useUserDb();
  const [organizationName, setOrganizationName] = useState("");
  const [taxRatePct, setTaxRatePct] = useState("0");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [buyersPremiumPct, setBuyersPremiumPct] = useState("0");
  const [error, setError] = useState<string | null>(null);

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
    setError(null);
  }, [
    event.id,
    event.organizationName,
    event.taxRate,
    event.currencySymbol,
    event.buyersPremiumRate,
  ]);

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
    const bpPct = Number(buyersPremiumPct);
    if (Number.isNaN(bpPct) || bpPct < 0 || bpPct > 100) {
      setError("Buyer’s premium must be between 0 and 100%.");
      return;
    }
    if (event.id == null || !db) return;
    await db.events.update(event.id, {
      organizationName: org,
      taxRate: pct / 100,
      buyersPremiumRate: bpPct / 100,
      currencySymbol: currencySymbol.trim() || "$",
      updatedAt: new Date(),
    });
    onSaved();
  }

  return (
    <Card>
      <h2 className="text-lg font-semibold text-navy">Current event settings</h2>
      <p className="mt-1 text-sm text-muted">
        Organization, tax, buyer&apos;s premium, and currency apply to invoices
        for{" "}
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
