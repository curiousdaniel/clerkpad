/** Minimal RFC-style CSV line parser (quoted fields, doubled quotes). */

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      result.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

/** Split on newlines that are outside quoted regions. */
export function splitCsvTextIntoLines(text: string): string[] {
  const lines: string[] = [];
  let start = 0;
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (!inQuotes && c === "\n") {
      lines.push(text.slice(start, i));
      start = i + 1;
    } else if (!inQuotes && c === "\r" && text[i + 1] === "\n") {
      lines.push(text.slice(start, i));
      start = i + 2;
      i++;
    }
  }
  lines.push(text.slice(start));
  return lines;
}

export function parseCsvTable(text: string): { headers: string[]; rows: string[][] } {
  const raw = splitCsvTextIntoLines(text.trim());
  if (raw.length === 0) return { headers: [], rows: [] };
  const headers = parseCsvLine(raw[0]!).map((h) => h.trim());
  const rows: string[][] = [];
  for (let r = 1; r < raw.length; r++) {
    const cells = parseCsvLine(raw[r]!);
    if (cells.every((c) => c.trim() === "")) continue;
    rows.push(cells);
  }
  return { headers, rows };
}

export function normalizeHeaderKey(h: string): string {
  return h
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}
