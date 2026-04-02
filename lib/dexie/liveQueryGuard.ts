/**
 * Dexie's useLiveQuery rethrows subscription errors during React render.
 * Wrap async queriers so IndexedDB failures surface in the console instead of a white screen.
 */
export async function liveQueryGuard<T>(
  label: string,
  fn: () => Promise<T> | T,
  fallback: T
): Promise<T> {
  try {
    return await Promise.resolve(fn());
  } catch (e) {
    console.error(`[ClerkBid Dexie] ${label}`, e);
    return fallback;
  }
}
