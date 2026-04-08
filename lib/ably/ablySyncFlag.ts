/** Client: enable Ably realtime nudges with NEXT_PUBLIC_ABLY_SYNC=1 */
export function isAblyRealtimeSyncEnabled(): boolean {
  if (typeof process === "undefined") return false;
  const v = process.env.NEXT_PUBLIC_ABLY_SYNC;
  return v === "1" || v === "true";
}
