/** Stable UUID for cross-device sync (sales, invoices). */
export function newEntitySyncKey(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sk-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
