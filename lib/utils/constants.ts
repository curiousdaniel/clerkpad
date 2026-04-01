/** Keep in sync with package.json version for display. */
export const APP_VERSION = "0.1.0";

export const PAYMENT_METHODS = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "credit_card", label: "Credit Card" },
  { value: "other", label: "Other" },
] as const;

export type PaymentMethodValue = (typeof PAYMENT_METHODS)[number]["value"];

export const LOT_STATUSES = [
  "unsold",
  "sold",
  "passed",
  "withdrawn",
] as const;

export const INVOICE_STATUSES = ["unpaid", "paid"] as const;
