import type { Session } from "next-auth";

export function parseSessionVendorId(session: Session | null): number | null {
  const v = session?.user?.vendorId;
  if (v == null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseSessionUserId(session: Session | null): number | null {
  const v = session?.user?.id;
  if (v == null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
