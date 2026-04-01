/**
 * Parse lot display like "0001", "1", "0001A" → base number + uppercase suffix.
 */
export function parseLotDisplay(
  input: string
): { base: number; suffix: string } | null {
  const t = input.trim().toUpperCase().replace(/\s+/g, "");
  if (!t) return null;
  const m = t.match(/^(\d{1,4})([A-Z]*)$/);
  if (!m) return null;
  const base = parseInt(m[1], 10);
  if (!Number.isFinite(base) || base < 1 || base > 9999) return null;
  return { base, suffix: m[2] ?? "" };
}

export function formatBaseLotDisplay(base: number): string {
  return base.toString().padStart(4, "0");
}
