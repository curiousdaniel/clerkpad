const SUGGEST_NEXT_LOT_KEY = "clerkbid:suggestNextLot";

/** Dispatched after writeSuggestNextLot (storage from other tabs also fires storage). */
export const SUGGEST_NEXT_LOT_CHANGED = "clerkbid:suggestNextLotChanged";

/** When true (default), clerking pre-fills the next sequential lot after reset or sale. */
export function readSuggestNextLot(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(SUGGEST_NEXT_LOT_KEY) !== "0";
  } catch {
    return true;
  }
}

export function writeSuggestNextLot(suggest: boolean): void {
  try {
    if (suggest) localStorage.removeItem(SUGGEST_NEXT_LOT_KEY);
    else localStorage.setItem(SUGGEST_NEXT_LOT_KEY, "0");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SUGGEST_NEXT_LOT_CHANGED));
  }
}

export function subscribeSuggestNextLot(onStoreChange: () => void): () => void {
  const fn = () => onStoreChange();
  if (typeof window !== "undefined") {
    window.addEventListener(SUGGEST_NEXT_LOT_CHANGED, fn);
    window.addEventListener("storage", fn);
    return () => {
      window.removeEventListener(SUGGEST_NEXT_LOT_CHANGED, fn);
      window.removeEventListener("storage", fn);
    };
  }
  return () => {};
}
