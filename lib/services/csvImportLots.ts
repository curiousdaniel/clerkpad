import { normalizeHeaderKey, parseCsvTable } from "@/lib/services/csvParse";

export type LotCsvRow = {
  baseLotNumber: number;
  lotSuffix: string;
  displayLotNumber: string;
  description: string;
  consignor?: string;
  /** When set, links to registry consignor with this number for the event. */
  consignorNumber?: number;
  quantity: number;
  notes?: string;
};

export type LotCsvImportIssue = { rowIndex: number; message: string };

const ALIASES: Record<string, keyof LotCsvRow> = {
  baselotnumber: "baseLotNumber",
  base_lot_number: "baseLotNumber",
  base: "baseLotNumber",
  lot: "baseLotNumber",
  lot_number: "baseLotNumber",
  lot_no: "baseLotNumber",
  lotnum: "baseLotNumber",
  lot_id: "baseLotNumber",
  item_lot: "baseLotNumber",
  catalog_lot: "baseLotNumber",
  lotsuffix: "lotSuffix",
  lot_suffix: "lotSuffix",
  suffix: "lotSuffix",
  description: "description",
  desc: "description",
  item: "description",
  item_description: "description",
  title: "description",
  consignor: "consignor",
  consignor_number: "consignorNumber",
  consignornumber: "consignorNumber",
  consignor_no: "consignorNumber",
  quantity: "quantity",
  qty: "quantity",
  count: "quantity",
  notes: "notes",
};

function colIndex(headers: string[], key: keyof LotCsvRow): number {
  const norm = headers.map(normalizeHeaderKey);
  for (let i = 0; i < norm.length; i++) {
    const k = ALIASES[norm[i]!];
    if (k === key) return i;
  }
  return -1;
}

export function parseLotCsv(text: string): {
  rows: LotCsvRow[];
  issues: LotCsvImportIssue[];
} {
  const { headers, rows: rawRows } = parseCsvTable(text);
  const issues: LotCsvImportIssue[] = [];
  if (headers.length === 0) {
    issues.push({ rowIndex: 0, message: "No header row found." });
    return { rows: [], issues };
  }

  const iBase = colIndex(headers, "baseLotNumber");
  const iSuffix = colIndex(headers, "lotSuffix");
  const iDesc = colIndex(headers, "description");
  const iConsignor = colIndex(headers, "consignor");
  const iConsignorNum = colIndex(headers, "consignorNumber");
  const iQty = colIndex(headers, "quantity");
  const iNotes = colIndex(headers, "notes");

  if (iBase < 0 || iDesc < 0) {
    issues.push({
      rowIndex: 0,
      message:
        "CSV must include a lot column (e.g. lot, lot number, base) and description (or desc). Optional: suffix, consignor, consignor number, quantity, notes.",
    });
    return { rows: [], issues };
  }

  const rows: LotCsvRow[] = [];
  const displaysSeen = new Set<string>();

  for (let r = 0; r < rawRows.length; r++) {
    const line = rawRows[r]!;
    const rowNum = r + 2;
    const baseStr = (line[iBase] ?? "").trim();
    const suffixRaw =
      iSuffix >= 0 ? (line[iSuffix] ?? "").trim().toUpperCase() : "";
    const description = (line[iDesc] ?? "").trim();
    const consignor =
      iConsignor >= 0 ? (line[iConsignor] ?? "").trim() : "";
    const consignorNumStr =
      iConsignorNum >= 0 ? (line[iConsignorNum] ?? "").trim() : "";
    const qtyStr = iQty >= 0 ? (line[iQty] ?? "").trim() : "1";
    const notes = iNotes >= 0 ? (line[iNotes] ?? "").trim() : "";

    if (!baseStr && !description) continue;

    const baseLotNumber = parseInt(baseStr, 10);
    if (!Number.isFinite(baseLotNumber) || baseLotNumber < 0) {
      issues.push({
        rowIndex: rowNum,
        message: `Invalid base lot number: "${baseStr}".`,
      });
      continue;
    }
    if (!description) {
      issues.push({ rowIndex: rowNum, message: "description is required." });
      continue;
    }

    const lotSuffix = suffixRaw.replace(/[^A-Z]/g, "");
    const displayLotNumber = baseStr.trim() + lotSuffix;
    if (displaysSeen.has(displayLotNumber)) {
      issues.push({
        rowIndex: rowNum,
        message: `Duplicate lot ${displayLotNumber} in file.`,
      });
      continue;
    }
    displaysSeen.add(displayLotNumber);

    let quantity = parseInt(qtyStr, 10);
    if (qtyStr === "" || Number.isNaN(quantity)) quantity = 1;
    if (quantity < 1) {
      issues.push({
        rowIndex: rowNum,
        message: "quantity must be at least 1.",
      });
      continue;
    }

    let consignorNumber: number | undefined;
    if (consignorNumStr) {
      const cn = parseInt(consignorNumStr, 10);
      if (!Number.isFinite(cn) || cn < 1) {
        issues.push({
          rowIndex: rowNum,
          message: `Invalid consignorNumber: "${consignorNumStr}".`,
        });
        continue;
      }
      consignorNumber = cn;
    }

    rows.push({
      baseLotNumber,
      lotSuffix,
      displayLotNumber,
      description,
      consignor: consignor || undefined,
      ...(consignorNumber != null ? { consignorNumber } : {}),
      quantity,
      notes: notes || undefined,
    });
  }

  return { rows, issues };
}
