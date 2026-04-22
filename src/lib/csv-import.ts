export type CsvRawRow = Record<string, string | undefined>;

export interface ParsedRow {
  rowIndex: number; // 1-based, matches spreadsheet
  parentCompany: string;
  childCompany: string;
  linkedinAccountId: string;
  last7dSpendCents: number;
  qtdSpendCents: number;
}

export interface RowWarning {
  rowIndex: number;
  level: "warning" | "error";
  message: string;
}

export interface ImportValidationResult {
  rows: ParsedRow[];
  warnings: RowWarning[];
  invalidCount: number;
}

const HEADER_ALIASES: Record<keyof Omit<ParsedRow, "rowIndex">, string[]> = {
  parentCompany: ["parent company", "parent account", "parent", "client", "parent co"],
  childCompany: ["child company", "child account", "child", "advertiser", "brand", "child co"],
  linkedinAccountId: [
    "linkedin ad account id",
    "linkedin account id",
    "ad account id",
    "account id",
    "account",
  ],
  last7dSpendCents: [
    "last 7 days spend",
    "last 7d spend",
    "sum l7d spend",
    "7 day spend",
    "7d spend",
    "last 7 days",
    "7-day spend",
  ],
  qtdSpendCents: ["qtd spend", "qtd", "quarter to date spend", "quarter to date"],
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

export function mapHeaders(headers: string[]): Record<keyof Omit<ParsedRow, "rowIndex">, string | null> {
  const normalizedHeaders = headers.map(normalize);
  const map = {} as Record<keyof Omit<ParsedRow, "rowIndex">, string | null>;
  (Object.keys(HEADER_ALIASES) as Array<keyof Omit<ParsedRow, "rowIndex">>).forEach((key) => {
    const match = HEADER_ALIASES[key].find((alias) => normalizedHeaders.includes(alias));
    const idx = match ? normalizedHeaders.indexOf(match) : -1;
    map[key] = idx >= 0 ? headers[idx] : null;
  });
  return map;
}

export function parseCurrencyToCents(raw: string | undefined | null): number | null {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (trimmed === "" || trimmed === "-" || trimmed.toLowerCase() === "n/a") return null;
  // strip $ commas and surrounding parens (accounting negatives)
  const negative = /^\(.*\)$/.test(trimmed);
  const cleaned = trimmed.replace(/[$,\s()]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const asNumber = Number(cleaned) * (negative ? -1 : 1);
  return Math.round(asNumber * 100);
}

export function validateRows(
  rawRows: CsvRawRow[],
  headers: string[],
): ImportValidationResult {
  const map = mapHeaders(headers);
  const warnings: RowWarning[] = [];
  const rows: ParsedRow[] = [];
  let invalid = 0;

  const missingRequired = (["parentCompany", "linkedinAccountId"] as const).filter((k) => !map[k]);
  if (missingRequired.length) {
    warnings.push({
      rowIndex: 0,
      level: "error",
      message: `Missing required column(s): ${missingRequired.join(", ")}`,
    });
    return { rows, warnings, invalidCount: rawRows.length };
  }

  let lastParent = "";
  let lastChild = "";

  rawRows.forEach((raw, i) => {
    const rowIndex = i + 2; // +1 for header, +1 for 1-based
    const parentCell = (raw[map.parentCompany!] ?? "").trim();
    const childCell = map.childCompany ? (raw[map.childCompany] ?? "").trim() : "";
    const acct = (raw[map.linkedinAccountId!] ?? "").trim();
    const last7Raw = map.last7dSpendCents ? raw[map.last7dSpendCents] : null;
    const qtdRaw = map.qtdSpendCents ? raw[map.qtdSpendCents] : null;

    // Skip spreadsheet summary rows like "Grand Total" / "Total".
    const parentNormalized = parentCell.toLowerCase();
    if (parentNormalized === "grand total" || parentNormalized === "total") {
      return;
    }

    // Forward-fill merged-cell blanks from the previous row. When a new parent
    // appears, reset the child scope so we don't inherit across parents.
    if (parentCell) {
      lastParent = parentCell;
      lastChild = childCell;
    } else if (childCell) {
      lastChild = childCell;
    }
    const parent = parentCell || lastParent;
    const child = childCell || lastChild || parent;

    if (!parent) {
      invalid++;
      warnings.push({ rowIndex, level: "error", message: "Parent company is empty — row skipped" });
      return;
    }
    if (!acct) {
      invalid++;
      warnings.push({
        rowIndex,
        level: "error",
        message: "LinkedIn ad account ID is empty — row skipped",
      });
      return;
    }

    const last7 = parseCurrencyToCents(last7Raw ?? "");
    const qtd = parseCurrencyToCents(qtdRaw ?? "");

    if (last7 == null) {
      warnings.push({
        rowIndex,
        level: "warning",
        message: "Last 7-day spend missing or unparseable — stored as $0",
      });
    }
    if (qtd == null) {
      warnings.push({
        rowIndex,
        level: "warning",
        message: "QTD spend missing or unparseable — stored as $0",
      });
    }
    if ((last7 ?? 0) < 0 || (qtd ?? 0) < 0) {
      warnings.push({
        rowIndex,
        level: "warning",
        message: "Negative spend value — import may need manual correction",
      });
    }

    rows.push({
      rowIndex,
      parentCompany: parent,
      childCompany: child,
      linkedinAccountId: acct,
      last7dSpendCents: Math.max(0, last7 ?? 0),
      qtdSpendCents: Math.max(0, qtd ?? 0),
    });
  });

  // flag duplicates within the file
  const seen = new Map<string, number>();
  rows.forEach((r) => {
    const existing = seen.get(r.linkedinAccountId);
    if (existing) {
      warnings.push({
        rowIndex: r.rowIndex,
        level: "warning",
        message: `Duplicate ad account ${r.linkedinAccountId} in file (also row ${existing})`,
      });
    } else {
      seen.set(r.linkedinAccountId, r.rowIndex);
    }
  });

  return { rows, warnings, invalidCount: invalid };
}
