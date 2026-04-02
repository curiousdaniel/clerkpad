const FONT_KEY = "clerkbid:fontScale";
const CONTRAST_KEY = "clerkbid:highContrast";
export const COLOR_SCHEME_STORAGE_KEY = "clerkbid:colorScheme";

export type FontScaleKey = "1" | "1.15" | "1.3";

export type ColorSchemePreference = "light" | "dark" | "system";

export const DEFAULT_COLOR_SCHEME: ColorSchemePreference = "system";

/** Inline head script: must stay in sync with readColorScheme / isEffectiveDark. */
export const THEME_BOOTSTRAP_SCRIPT = `(function(){try{var k=${JSON.stringify(COLOR_SCHEME_STORAGE_KEY)};var v=localStorage.getItem(k)||"system";var d=v==="dark"||(v==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);}catch(e){}})();`;

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

export function readColorScheme(): ColorSchemePreference {
  if (typeof window === "undefined") return DEFAULT_COLOR_SCHEME;
  try {
    const v = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_COLOR_SCHEME;
}

export function writeColorScheme(p: ColorSchemePreference): void {
  try {
    localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, p);
  } catch {
    /* ignore */
  }
}

export function isEffectiveDark(pref: ColorSchemePreference): boolean {
  if (typeof window === "undefined") return false;
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function applyColorSchemeClass(pref: ColorSchemePreference): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", isEffectiveDark(pref));
}

export function applyDisplayPrefsToDocument(
  font: FontScaleKey,
  highContrast: boolean,
  colorScheme: ColorSchemePreference
): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.fontScale = font;
  document.documentElement.dataset.highContrast = highContrast ? "true" : "false";
  applyColorSchemeClass(colorScheme);
}
