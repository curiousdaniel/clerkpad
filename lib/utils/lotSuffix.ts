/** Bijective rank for comparing pass-out suffixes (""=0, A=1 … Z=26, AA=27, …). */
export function suffixRank(s: string): number {
  if (s === "") return 0;
  let r = 0;
  for (let i = 0; i < s.length; i++) {
    const v = s.charCodeAt(i) - 64;
    if (v < 1 || v > 26) return -1;
    r = r * 26 + v;
  }
  return r;
}

export function maxLotSuffix(suffixes: string[]): string {
  if (suffixes.length === 0) return "";
  let best = "";
  let bestR = -1;
  for (const s of suffixes) {
    const r = suffixRank(s);
    if (r > bestR) {
      bestR = r;
      best = s;
    }
  }
  return best;
}

/** Next alpha suffix: ""→A, A→B, Z→AA, AZ→BA, ZZ→AAA */
export function nextSuffix(current: string): string {
  if (current === "") return "A";
  const chars = current.split("");
  let i = chars.length - 1;
  while (i >= 0) {
    if (chars[i] === "Z") {
      chars[i] = "A";
      i--;
    } else {
      chars[i] = String.fromCharCode(chars[i]!.charCodeAt(0) + 1);
      return chars.join("");
    }
  }
  return "A" + chars.join("");
}

/** Canonical display: unpadded base + suffix (no leading zeros added). */
export function displayLotNumberFromParts(
  baseLotNumber: number,
  lotSuffix: string
): string {
  return String(baseLotNumber) + lotSuffix;
}
