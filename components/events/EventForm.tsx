"use client";

import { useEffect, useState } from "react";
import type { AuctionEvent } from "@/lib/db";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  editing?: AuctionEvent | null;
};

export function EventForm({ open, onClose, onSaved, editing }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [taxRatePct, setTaxRatePct] = useState("0");
  const [currencySymbol, setCurrencySymbol] = useState("$");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setName(editing.name);
      setDescription(editing.description ?? "");
      setOrganizationName(editing.organizationName);
      setTaxRatePct(String((editing.taxRate * 100).toFixed(4).replace(/\.?0+$/, "")));
      setCurrencySymbol(editing.currencySymbol);
    } else {
      setName("");
      setDescription("");
      setOrganizationName("");
      setTaxRatePct("0");
      setCurrencySymbol("$");
    }
  }, [open, editing]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const n = name.trim();
    const org = organizationName.trim();
    if (!n) {
      setError("Event name is required.");
      return;
    }
    if (!org) {
      setError("Organization name is required.");
      return;
    }
    const pct = Number(taxRatePct);
    if (Number.isNaN(pct) || pct < 0) {
      setError("Tax rate must be a non-negative number (percent).");
      return;
    }
    const taxRate = pct / 100;
    const now = new Date();
    if (editing?.id != null) {
      await db.events.update(editing.id, {
        name: n,
        description: description.trim() || undefined,
        organizationName: org,
        taxRate,
        currencySymbol: currencySymbol.trim() || "$",
        updatedAt: now,
      });
    } else {
      await db.events.add({
        name: n,
        description: description.trim() || undefined,
        organizationName: org,
        taxRate,
        currencySymbol: currencySymbol.trim() || "$",
        createdAt: now,
        updatedAt: now,
      });
    }
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      title={editing ? "Edit event" : "Create event"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="event-form" variant="primary">
            {editing ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <form id="event-form" className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Input
          id="ev-name"
          label="Event name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <div>
          <label htmlFor="ev-desc" className="mb-1 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="ev-desc"
            className="w-full rounded-lg border border-navy/20 px-3 py-2 text-sm focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <Input
          id="ev-org"
          label="Organization name"
          value={organizationName}
          onChange={(e) => setOrganizationName(e.target.value)}
          required
        />
        <Input
          id="ev-tax"
          label="Tax rate (%)"
          type="number"
          inputMode="decimal"
          step="0.0001"
          min={0}
          value={taxRatePct}
          onChange={(e) => setTaxRatePct(e.target.value)}
        />
        <Input
          id="ev-currency"
          label="Currency symbol"
          value={currencySymbol}
          onChange={(e) => setCurrencySymbol(e.target.value)}
          maxLength={4}
        />
      </form>
    </Modal>
  );
}
