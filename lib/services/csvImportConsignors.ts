import { normalizeHeaderKey, parseCsvTable } from "@/lib/services/csvParse";

export type ConsignorCsvRow = {
  consignorNumber: number;
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
  /** 0–100 when present */
  commissionPct?: number;
};

export type ConsignorCsvImportIssue = { rowIndex: number; message: string };

const ALIASES: Record<string, keyof ConsignorCsvRow | "commissionPct"> = {
  consignornumber: "consignorNumber",
  consignor_number: "consignorNumber",
  number: "consignorNumber",
  consignor_no: "consignorNumber",
  consignorno: "consignorNumber",
  name: "name",
  email: "email",
  phone: "phone",
  notes: "notes",
  commission: "commissionPct",
  commission_pct: "commissionPct",
  commissionpercent: "commissionPct",
  commission_percent: "commissionPct",
};

function colIndex(
  headers: string[],
  key: keyof ConsignorCsvRow | "commissionPct"
): number {
  const norm = headers.map(normalizeHeaderKey);
  for (let i = 0; i < norm.length; i++) {
    const k = ALIASES[norm[i]!];
    if (k === key) return i;
  }
  return -1;
}

function parseOptionalPct(raw: string): number | undefined {
  const t = raw.trim();
  if (!t) return undefined;
  const n = Number(t.replace(/%/g, ""));
  if (!Number.isFinite(n) || n < 0 || n > 100) return undefined;
  return n;
}

export function parseConsignorCsv(text: string): {
  rows: ConsignorCsvRow[];
  issues: ConsignorCsvImportIssue[];
} {
  const { headers, rows: rawRows } = parseCsvTable(text);
  const issues: ConsignorCsvImportIssue[] = [];
  if (headers.length === 0) {
    issues.push({ rowIndex: 0, message: "No header row found." });
    return { rows: [], issues };
  }

  const iNum = colIndex(headers, "consignorNumber");
  const iName = colIndex(headers, "name");
  const iEmail = colIndex(headers, "email");
  const iPhone = colIndex(headers, "phone");
  const iNotes = colIndex(headers, "notes");
  const iComm = colIndex(headers, "commissionPct");

  if (iNum < 0 || iName < 0) {
    issues.push({
      rowIndex: 0,
      message:
        "CSV must include consignorNumber (or number) and name. Optional: email, phone, notes, commission (%).",
    });
    return { rows: [], issues };
  }

  const rows: ConsignorCsvRow[] = [];
  const numbersSeen = new Set<number>();

  for (let r = 0; r < rawRows.length; r++) {
    const line = rawRows[r]!;
    const rowNum = r + 2;
    const numStr = (line[iNum] ?? "").trim();
    const name = (line[iName] ?? "").trim();
    const email = iEmail >= 0 ? (line[iEmail] ?? "").trim() : "";
    const phone = iPhone >= 0 ? (line[iPhone] ?? "").trim() : "";
    const notes = iNotes >= 0 ? (line[iNotes] ?? "").trim() : "";
    const commRaw = iComm >= 0 ? (line[iComm] ?? "").trim() : "";

    if (!numStr && !name) continue;

    const consignorNumber = parseInt(numStr, 10);
    if (!Number.isFinite(consignorNumber) || consignorNumber < 1) {
      issues.push({
        rowIndex: rowNum,
        message: `Invalid consignor number: "${numStr}".`,
      });
      continue;
    }
    if (!name) {
      issues.push({
        rowIndex: rowNum,
        message: "name is required.",
      });
      continue;
    }
    if (numbersSeen.has(consignorNumber)) {
      issues.push({
        rowIndex: rowNum,
        message: `Duplicate consignor ${consignorNumber} in file.`,
      });
      continue;
    }
    numbersSeen.add(consignorNumber);

    let commissionPct: number | undefined;
    if (commRaw) {
      const pct = parseOptionalPct(commRaw);
      if (pct === undefined) {
        issues.push({
          rowIndex: rowNum,
          message: `Invalid commission "${commRaw}" (use 0–100).`,
        });
        continue;
      }
      commissionPct = pct;
    }

    rows.push({
      consignorNumber,
      name,
      email: email || undefined,
      phone: phone || undefined,
      notes: notes || undefined,
      commissionPct,
    });
  }

  return { rows, issues };
}
