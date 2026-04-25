import { parseCurrencyToCents, type CsvRawRow, type RowWarning } from "./csv-import";
import { PROBABILITY_BUCKETS } from "./forecast";

export interface ParsedOppRow {
  rowIndex: number;
  name: string;
  linkedinAccountId: string;
  forecastedCents: number;
  probabilityPct: number;
  expectedCloseDate: string | null;
  ownerName: string | null;
  goToMarketNotes: string | null;
  rolesAndResponsibilities: string | null;
  notes: string | null;
}

export interface OppImportValidationResult {
  rows: ParsedOppRow[];
  warnings: RowWarning[];
  invalidCount: number;
}

type FieldKey = keyof Omit<ParsedOppRow, "rowIndex">;

const HEADER_ALIASES: Record<FieldKey, string[]> = {
  name: ["name", "opportunity", "opportunity name", "deal", "deal name"],
  linkedinAccountId: [
    "linkedin ad account id",
    "linkedin account id",
    "ad account id",
    "account id",
    "account",
  ],
  forecastedCents: [
    "forecasted pipeline",
    "forecasted revenue",
    "forecast",
    "pipeline",
    "forecasted pipeline usd",
    "forecast usd",
    "amount",
  ],
  probabilityPct: ["probability", "probability %", "probability pct", "prob", "prob %"],
  expectedCloseDate: [
    "expected close date",
    "close date",
    "expected close",
    "target close",
    "target close date",
  ],
  ownerName: ["owner", "owner name", "ae", "assigned to", "assignee"],
  goToMarketNotes: [
    "go to market notes",
    "go-to-market notes",
    "gtm notes",
    "go to market",
    "gtm",
    "go to market strategy notes",
  ],
  rolesAndResponsibilities: [
    "roles and responsibilities",
    "roles & responsibilities",
    "roles",
    "responsibilities",
    "raci",
  ],
  notes: ["notes", "internal notes", "comments"],
};

function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[_\s]+/g, " ");
}

export function mapOppHeaders(headers: string[]): Record<FieldKey, string | null> {
  const normalizedHeaders = headers.map(normalize);
  const map = {} as Record<FieldKey, string | null>;
  (Object.keys(HEADER_ALIASES) as FieldKey[]).forEach((key) => {
    const match = HEADER_ALIASES[key].find((alias) => normalizedHeaders.includes(alias));
    const idx = match ? normalizedHeaders.indexOf(match) : -1;
    map[key] = idx >= 0 ? headers[idx] : null;
  });
  return map;
}

function parseProbability(raw: string | undefined): { value: number | null; note?: string } {
  if (raw == null) return { value: null };
  const trimmed = String(raw).trim().replace(/%/g, "");
  if (trimmed === "") return { value: null };
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return { value: null };
  if ((PROBABILITY_BUCKETS as readonly number[]).includes(n)) return { value: n };
  // snap to nearest bucket
  let nearest: number = PROBABILITY_BUCKETS[0];
  let bestDiff = Math.abs(n - nearest);
  for (const b of PROBABILITY_BUCKETS) {
    const diff = Math.abs(n - b);
    if (diff < bestDiff) {
      bestDiff = diff;
      nearest = b;
    }
  }
  return { value: nearest, note: `Probability ${n} not in bucket — snapped to ${nearest}%` };
}

function parseDate(raw: string | undefined): { value: string | null; note?: string } {
  if (raw == null) return { value: null };
  const trimmed = String(raw).trim();
  if (trimmed === "") return { value: null };
  // YYYY-MM-DD
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) {
    const [, y, m, d] = iso;
    return { value: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` };
  }
  // M/D/YYYY or MM/DD/YYYY
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (us) {
    const [, m, d, y] = us;
    return { value: `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` };
  }
  return { value: null, note: `Close date "${trimmed}" not parseable — stored as blank` };
}

function cell(raw: CsvRawRow, col: string | null): string {
  if (!col) return "";
  return (raw[col] ?? "").trim();
}

function nullIfBlank(s: string): string | null {
  return s === "" ? null : s;
}

export function validateOppRows(
  rawRows: CsvRawRow[],
  headers: string[],
): OppImportValidationResult {
  const map = mapOppHeaders(headers);
  const warnings: RowWarning[] = [];
  const rows: ParsedOppRow[] = [];
  let invalid = 0;

  const missingRequired = (["name", "linkedinAccountId", "probabilityPct"] as const).filter(
    (k) => !map[k],
  );
  if (missingRequired.length) {
    warnings.push({
      rowIndex: 0,
      level: "error",
      message: `Missing required column(s): ${missingRequired.join(", ")}`,
    });
    return { rows, warnings, invalidCount: rawRows.length };
  }

  rawRows.forEach((raw, i) => {
    const rowIndex = i + 2;
    const name = cell(raw, map.name);
    const acct = cell(raw, map.linkedinAccountId);
    const probRaw = cell(raw, map.probabilityPct);
    const forecastRaw = cell(raw, map.forecastedCents);

    // Skip entirely blank rows silently
    if (!name && !acct && !probRaw && !forecastRaw) return;

    if (!name) {
      invalid++;
      warnings.push({ rowIndex, level: "error", message: "Name is empty — row skipped" });
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

    const prob = parseProbability(probRaw);
    if (prob.value == null) {
      invalid++;
      warnings.push({
        rowIndex,
        level: "error",
        message: "Probability is empty or unparseable — row skipped",
      });
      return;
    }
    if (prob.note) {
      warnings.push({ rowIndex, level: "warning", message: prob.note });
    }

    const forecastCents = parseCurrencyToCents(forecastRaw);
    if (forecastCents == null) {
      warnings.push({
        rowIndex,
        level: "warning",
        message: "Forecasted pipeline missing or unparseable — stored as $0",
      });
    }

    const closeDate = parseDate(cell(raw, map.expectedCloseDate));
    if (closeDate.note) {
      warnings.push({ rowIndex, level: "warning", message: closeDate.note });
    }

    rows.push({
      rowIndex,
      name,
      linkedinAccountId: acct,
      forecastedCents: Math.max(0, forecastCents ?? 0),
      probabilityPct: prob.value,
      expectedCloseDate: closeDate.value,
      ownerName: nullIfBlank(cell(raw, map.ownerName)),
      goToMarketNotes: nullIfBlank(cell(raw, map.goToMarketNotes)),
      rolesAndResponsibilities: nullIfBlank(cell(raw, map.rolesAndResponsibilities)),
      notes: nullIfBlank(cell(raw, map.notes)),
    });
  });

  return { rows, warnings, invalidCount: invalid };
}
