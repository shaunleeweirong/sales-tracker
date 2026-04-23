"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Upload, CheckCircle2, AlertTriangle, X, Download, Info } from "lucide-react";
import { validateOppRows, type ParsedOppRow } from "@/lib/opp-import";
import type { RowWarning } from "@/lib/csv-import";
import { commitOppImport } from "./actions";
import { formatCents } from "@/lib/forecast";

const TEMPLATE_HEADERS = [
  "Name",
  "LinkedIn Ad Account ID",
  "Forecasted Pipeline",
  "Probability %",
  "Expected Close Date",
  "Owner",
  "Team",
  "Go-to-market Notes",
  "Roles and Responsibilities",
  "Notes",
];

const TEMPLATE_SAMPLE = [
  "Q2 Renewal - Acme Brand",
  "123456789",
  "50000",
  "50",
  "2026-06-30",
  "",
  "",
  "Expansion play via performance account",
  "AE leads commercial; SE owns creative",
  "",
];

function downloadTemplate() {
  const csv = [TEMPLATE_HEADERS, TEMPLATE_SAMPLE]
    .map((row) => row.map((v) => `"${v}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "opportunity-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function OppUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedOppRow[]>([]);
  const [warnings, setWarnings] = useState<RowWarning[]>([]);
  const [invalid, setInvalid] = useState(0);
  const [pending, startTransition] = useTransition();

  async function handleFile(f: File) {
    setFile(f);
    let csvText: string;
    if (/\.xlsx?$/i.test(f.name)) {
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      csvText = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
    } else {
      csvText = await f.text();
    }
    const parsed = Papa.parse<Record<string, string | undefined>>(csvText, {
      header: true,
      skipEmptyLines: true,
    });
    const headers = parsed.meta.fields ?? [];
    const result = validateOppRows(parsed.data, headers);
    setRows(result.rows);
    setWarnings(result.warnings);
    setInvalid(result.invalidCount);
  }

  function reset() {
    setFile(null);
    setRows([]);
    setWarnings([]);
    setInvalid(0);
  }

  function commit() {
    if (!file || rows.length === 0) return;
    startTransition(async () => {
      const res = await commitOppImport({
        rows: rows.map((r) => ({ ...r })),
      });
      if (res.error) toast.error(res.error);
      else {
        const skippedMsg = res.skipped ? ` · ${res.skipped} skipped` : "";
        toast.success(`Created ${res.imported} opportunities${skippedMsg}`);
        const serverMsgs: RowWarning[] = [
          ...(res.errors ?? []).map<RowWarning>((e) => ({
            rowIndex: e.rowIndex,
            level: "error",
            message: e.message,
          })),
          ...(res.warnings ?? []).map<RowWarning>((w) => ({
            rowIndex: w.rowIndex,
            level: "warning",
            message: w.message,
          })),
        ];
        if (serverMsgs.length) {
          setWarnings((prev) => [...prev, ...serverMsgs]);
          return;
        }
        reset();
        router.push("/opportunities");
        router.refresh();
      }
    });
  }

  const errors = warnings.filter((w) => w.level === "error");
  const warns = warnings.filter((w) => w.level === "warning");

  if (!file) {
    return (
      <div className="flex flex-col gap-3">
        <div className="rounded-md border bg-muted/40 px-4 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">New here?</span> Download the template,
            fill it in, and upload below.
          </div>
          <Button variant="outline" size="sm" onClick={downloadTemplate} className="shrink-0">
            <Download className="h-4 w-4" />
            Download template
          </Button>
        </div>
        <div className="rounded-md border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 flex items-start gap-2 text-sm">
          <Info className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            Ad accounts must already exist — import weekly spend first so the{" "}
            <span className="font-mono">LinkedIn Ad Account ID</span> column resolves. Re-uploading
            this file will create duplicate opportunities.
          </div>
        </div>
        <Card>
          <CardContent
            className="p-12 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center flex flex-col items-center gap-3"
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <div className="text-sm">
              Drop CSV or Excel here, or{" "}
              <label className="text-primary hover:underline cursor-pointer">
                choose file
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                />
              </label>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-md border bg-background p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{file.name}</span>
          <span className="text-xs text-muted-foreground">
            · {rows.length} valid rows · {invalid} skipped · {warns.length} warnings
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>
          <X className="h-4 w-4" /> Clear
        </Button>
      </div>

      {(errors.length > 0 || warns.length > 0) && (
        <div className="rounded-md border bg-background p-3 text-sm max-h-52 overflow-auto flex flex-col gap-1">
          {errors.map((w, i) => (
            <div key={`e-${i}`} className="flex items-start gap-2 text-rose-600">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Row {w.rowIndex || "header"}: {w.message}
              </span>
            </div>
          ))}
          {warns.map((w, i) => (
            <div key={`w-${i}`} className="flex items-start gap-2 text-amber-600">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                Row {w.rowIndex}: {w.message}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border bg-background overflow-auto max-h-[50vh]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Row</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Acct ID</TableHead>
              <TableHead className="text-right">Forecasted</TableHead>
              <TableHead className="text-right">Prob</TableHead>
              <TableHead>Close</TableHead>
              <TableHead>Owner</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 50).map((r) => (
              <TableRow key={r.rowIndex}>
                <TableCell className="text-muted-foreground">{r.rowIndex}</TableCell>
                <TableCell>{r.name}</TableCell>
                <TableCell className="font-mono text-xs">{r.linkedinAccountId}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCents(r.forecastedCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">{r.probabilityPct}%</TableCell>
                <TableCell>{r.expectedCloseDate ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.ownerName ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {rows.length > 50 && (
          <div className="p-2 text-center text-xs text-muted-foreground">
            Showing first 50 of {rows.length} rows…
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={reset} disabled={pending}>Cancel</Button>
        <Button onClick={commit} disabled={pending || rows.length === 0}>
          <CheckCircle2 className="h-4 w-4" />
          {pending ? "Committing…" : `Commit ${rows.length} rows`}
        </Button>
      </div>
    </div>
  );
}
