/** Enable with NEXT_PUBLIC_SYNC_OPS=1 (build-time for client bundle). */
export function isSyncOpsEnabled(): boolean {
  if (typeof process === "undefined") return false;
  const v = process.env.NEXT_PUBLIC_SYNC_OPS;
  return v === "1" || v === "true";
}
