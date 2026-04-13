function normalizeLotDisplayInput(input: string): string {
  return input.trim().normalize("NFKC").toUpperCase().replace(/\s+/g, "");
}

/**
 * Parse lot display like "0001", "1", "0001A" → base number + uppercase suffix.
 */
export function parseLotDisplay(
  input: string
): { base: number; suffix: string } | null {
  const t = normalizeLotDisplayInput(input);
  if (!t) return null;
  const m = t.match(/^(\d{1,4})([A-Z]*)$/);
  if (!m) return null;
  const base = parseInt(m[1], 10);
  if (!Number.isFinite(base) || base < 1 || base > 9999) return null;
  return { base, suffix: m[2] ?? "" };
}

/** Suggested next lot field: numeric base only, no zero-padding. */
export function formatBaseLotDisplay(base: number): string {
  return String(base);
}

/**
 * Digit run as entered (after trim / uppercase / collapse spaces), e.g. "1", "001".
 */
export function lotDisplayBaseDigits(input: string): string | null {
  const parsed = parseLotDisplay(input);
  if (!parsed) return null;
  const t = normalizeLotDisplayInput(input);
  const m = t.match(/^(\d{1,4})/);
  return m ? m[1]! : null;
}

/** Full display string preserving typed digits + uppercase suffix (e.g. "1", "001A"). */
export function formatLotDisplayFromInput(input: string): string | null {
  const parsed = parseLotDisplay(input);
  if (!parsed) return null;
  const t = normalizeLotDisplayInput(input);
  const m = t.match(/^(\d{1,4})([A-Z]*)$/);
  if (!m) return null;
  return m[1]! + (m[2] ?? "");
}
