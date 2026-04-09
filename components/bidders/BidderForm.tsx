"use client";

import { useEffect, useState } from "react";
import type { Bidder } from "@/lib/db";
import { useUserDb } from "@/components/providers/UserDbProvider";
import { useCloudSync } from "@/components/providers/CloudSyncProvider";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getSuggestedPaddleNumber } from "@/lib/hooks/useBidders";
import { mutateWithParentEventTouch } from "@/lib/db/mutateWithParentEventTouch";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventId: number;
  editing?: Bidder | null;
};

export function BidderForm({
  open,
  onClose,
  onSaved,
  eventId,
  editing,
}: Props) {
  const { db } = useUserDb();
  const { scheduleCloudPush } = useCloudSync();
  const [paddleNumber, setPaddleNumber] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    (async () => {
      if (!db) return;
      if (editing) {
        setPaddleNumber(String(editing.paddleNumber));
        setFirstName(editing.firstName);
        setLastName(editing.lastName);
        setPhone(editing.phone ?? "");
        setEmail(editing.email ?? "");
      } else {
        const next = await getSuggestedPaddleNumber(db, eventId);
        setPaddleNumber(String(next));
        setFirstName("");
        setLastName("");
        setPhone("");
        setEmail("");
      }
    })();
  }, [open, editing, eventId, db]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    setError(null);
    const paddle = parseInt(paddleNumber.trim(), 10);
    if (!Number.isFinite(paddle) || paddle < 1) {
      setError("Paddle number must be a positive integer.");
      return;
    }
    const fn = firstName.trim();
    const ln = lastName.trim();
    if (!fn || !ln) {
      setError("First and last name are required.");
      return;
    }
    const taken = await db.bidders
      .where("[eventId+paddleNumber]")
      .equals([eventId, paddle])
      .first();
    const editingId = editing?.id;
    if (
      taken != null &&
      (typeof editingId !== "number" || taken.id !== editingId)
    ) {
      setError(`Paddle #${paddle} is already registered for this event.`);
      return;
    }
    const now = new Date();
    try {
      await mutateWithParentEventTouch(db, eventId, "bidders", async () => {
        if (editing?.id != null) {
          await db.bidders.update(editing.id, {
            paddleNumber: paddle,
            firstName: fn,
            lastName: ln,
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            updatedAt: now,
          });
        } else {
          await db.bidders.add({
            eventId,
            paddleNumber: paddle,
            firstName: fn,
            lastName: ln,
            phone: phone.trim() || undefined,
            email: email.trim() || undefined,
            createdAt: now,
            updatedAt: now,
          });
        }
      });
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save bidder. Try again."
      );
      return;
    }
    scheduleCloudPush();
    onSaved();
    onClose();
  }

  return (
    <Modal
      open={open}
      title={editing ? "Edit bidder" : "Register bidder"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="bidder-form">
            {editing ? "Save" : "Add bidder"}
          </Button>
        </>
      }
    >
      <form id="bidder-form" className="space-y-4" onSubmit={handleSubmit}>
        {error ? (
          <p className="text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
        <Input
          id="bd-paddle"
          label="Paddle number"
          inputMode="numeric"
          value={paddleNumber}
          onChange={(e) => setPaddleNumber(e.target.value)}
          required
        />
        <Input
          id="bd-fn"
          label="First name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          id="bd-ln"
          label="Last name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
        <Input
          id="bd-phone"
          label="Phone"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Input
          id="bd-email"
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </form>
    </Modal>
  );
}
