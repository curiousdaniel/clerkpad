"use client";

import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

const STEPS = [
  {
    title: "Step 1 of 3",
    body: "This will permanently delete every bidder, lot, sale, and invoice for the current event. The event itself will remain so you can start fresh.",
  },
  {
    title: "Step 2 of 3",
    body: "This cannot be undone. Make sure you have exported a backup if you need this data later.",
  },
  {
    title: "Step 3 of 3",
    body: "Final confirmation: all clerking and invoice data for this event will be erased.",
  },
] as const;

export function ClearEventDataDialog({
  open,
  eventName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  eventName: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const meta = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <Modal
      open={open}
      title={meta.title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          {!isLast ? (
            <Button type="button" onClick={() => setStep((s) => s + 1)}>
              Continue
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              onClick={() => void onConfirm()}
            >
              Delete all event data
            </Button>
          )}
        </>
      }
    >
      <p className="text-sm text-muted">{meta.body}</p>
      <p className="mt-3 font-medium text-navy">Event: {eventName}</p>
    </Modal>
  );
}
