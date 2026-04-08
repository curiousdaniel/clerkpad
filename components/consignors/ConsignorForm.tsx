"use client";

import { useEffect, useState } from "react";
import type { Consignor } from "@/lib/db";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { useCloudSync } from "@/components/providers/CloudSyncProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getSuggestedConsignorNumber } from "@/lib/hooks/useConsignors";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: number;
  editing?: Consignor | null;
};

export function ConsignorForm({
  open,
  onClose,
  onSaved,
  eventId,
  editing,
}: Props) {
  const { db } = useUserDb();
  const { scheduleCloudPush } = useCloudSync();
  const [consignorNumber, setConsignorNumber] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [mailingAddress, setMailingAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [commissionPct, setCommissionPct] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    (async () => {
      if (!db) return;
      if (editing) {
        setConsignorNumber(String(editing.consignorNumber));
        setName(editing.name);
        setPhone(editing.phone ?? "");
        setEmail(editing.email ?? "");
        setMailingAddress(editing.mailingAddress ?? "");
        setNotes(editing.notes ?? "");
        setCommissionPct(
          typeof editing.commissionRate === "number"
            ? String((editing.commissionRate * 100).toFixed(2).replace(/\.?0+$/, ""))
            : ""
        );
      } else {
        const next = await getSuggestedConsignorNumber(db, eventId);
        setConsignorNumber(String(next));
        setName("");
        setPhone("");
        setEmail("");
        setMailingAddress("");
        setNotes("");
        setCommissionPct("");
      }
    })();
  }, [open, editing, eventId, db]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setError(null);
    const num = parseInt(consignorNumber.trim(), 10);
    if (!Number.isFinite(num) || num < 1) {
      setError("Consignor number must be a positive integer.");
      return;
    }
    const nm = name.trim();
    if (!nm) {
      setError("Name is required.");
      return;
    }
    const taken = await db.consignors
      .where("[eventId+consignorNumber]")
      .equals([eventId, num])
      .first();
    if (taken && taken.id !== editing?.id) {
      setError(`Consignor #${num} is already registered for this event.`);
      return;
    }

    let commissionRate: number | undefined;
    const cp = commissionPct.trim();
    if (cp) {
      const pct = Number(cp);
      if (Number.isNaN(pct) || pct < 0 || pct > 100) {
        setError("Commission override must be between 0 and 100% (or leave blank for event default).");
        return;
      }
      commissionRate = pct / 100;
    }

    const now = new Date();
    if (editing?.id != null) {
      const existing = await db.consignors.get(editing.id);
      if (!existing) return;
      const next: Consignor = {
        ...existing,
        consignorNumber: num,
        name: nm,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        updatedAt: now,
      };
      const ma = mailingAddress.trim();
      if (ma) next.mailingAddress = ma;
      else delete next.mailingAddress;
      if (commissionRate !== undefined) next.commissionRate = commissionRate;
      else delete next.commissionRate;
      await db.consignors.put(next);
    } else {
      const row: Consignor = {
        eventId,
        consignorNumber: num,
        name: nm,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      const maNew = mailingAddress.trim();
      if (maNew) row.mailingAddress = maNew;
      if (commissionRate !== undefined) row.commissionRate = commissionRate;
      await db.consignors.add(row);
    }
    scheduleCloudPush();
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      title={editing ? "Edit consignor" : "Add consignor"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="consignor-form" variant="primary">
            Save
          </Button>
        </>
      }
    >
      <form id="consignor-form" className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Input
          id="consignor-num"
          label="Consignor number"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={consignorNumber}
          onChange={(e) => setConsignorNumber(e.target.value)}
          required
        />
        <Input
          id="consignor-name"
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          id="consignor-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Input
          id="consignor-phone"
          label="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div>
          <label
            htmlFor="consignor-mailing"
            className="mb-1 block text-sm font-medium text-ink dark:text-slate-200"
          >
            Mailing address
          </label>
          <textarea
            id="consignor-mailing"
            rows={3}
            value={mailingAddress}
            onChange={(e) => setMailingAddress(e.target.value)}
            placeholder="Street, city, state, ZIP — for mailing checks"
            className="w-full rounded-lg border border-navy/20 bg-white px-3 py-2 text-sm text-ink placeholder:text-muted focus:border-navy focus:outline-none focus:ring-1 focus:ring-navy dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
          />
        </div>
        <Input
          id="consignor-notes"
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <Input
          id="consignor-commission"
          label="Commission override (%)"
          type="number"
          inputMode="decimal"
          step="0.01"
          min={0}
          max={100}
          value={commissionPct}
          onChange={(e) => setCommissionPct(e.target.value)}
          placeholder="Leave blank to use event default"
        />
      </form>
    </Modal>
  );
}
