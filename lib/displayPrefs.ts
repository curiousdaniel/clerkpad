const FONT_KEY = "clerkbid:fontScale";
const CONTRAST_KEY = "clerkbid:highContrast";

export type FontScaleKey = "1" | "1.15" | "1.3";

export function readFontScale(): FontScaleKey {
  if (typeof window === "undefined") return "1";
  try {
    const v = localStorage.getItem(FONT_KEY);
    if (v === "1.15" || v === "1.3") return v;
  } catch {
    /* ignore */
  }
  return "1";
}

export function writeFontScale(v: FontScaleKey): void {
  try {
    localStorage.setItem(FONT_KEY, v);
  } catch {
    /* ignore */
  }
}

export function readHighContrast(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(CONTRAST_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeHighContrast(on: boolean): void {
  try {
    if (on) localStorage.setItem(CONTRAST_KEY, "1");
    else localStorage.removeItem(CONTRAST_KEY);
  } catch {
    /* ignore */
  }
}

export function applyDisplayPrefsToDocument(
  font: FontScaleKey,
  highContrast: boolean
): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.fontScale = font;
  document.documentElement.dataset.highContrast = highContrast ? "true" : "false";
}
