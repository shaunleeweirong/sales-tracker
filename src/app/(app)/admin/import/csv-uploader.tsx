"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
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
import { Upload, CheckCircle2, AlertTriangle, X } from "lucide-react";
import { validateRows, type ParsedRow, type RowWarning } from "@/lib/csv-import";
import { commitImport } from "./actions";
import { formatCents } from "@/lib/forecast";

export function CsvUploader() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [warnings, setWarnings] = useState<RowWarning[]>([]);
  const [invalid, setInvalid] = useState(0);
  const [pending, startTransition] = useTransition();

  async function handleFile(f: File) {
    setFile(f);
    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const headers = meta.fields ?? [];
        const result = validateRows(data as Record<string, string | undefined>[], headers);
        setRows(result.rows);
        setWarnings(result.warnings);
        setInvalid(result.invalidCount);
      },
    });
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
      const res = await commitImport({
        fileName: file.name,
        rows: rows.map((r) => ({
          parentCompany: r.parentCompany,
          childCompany: r.childCompany,
          linkedinAccountId: r.linkedinAccountId,
          last7dSpendCents: r.last7dSpendCents,
          qtdSpendCents: r.qtdSpendCents,
        })),
        warnings: warnings.length,
      });
      if (res.error) toast.error(res.error);
      else {
        toast.success(`Imported ${rows.length} rows`);
        reset();
        router.push("/companies");
        router.refresh();
      }
    });
  }

  const errors = warnings.filter((w) => w.level === "error");
  const warns = warnings.filter((w) => w.level === "warning");

  if (!file) {
    return (
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
            Drop CSV here, or{" "}
            <label className="text-primary hover:underline cursor-pointer">
              choose file
              <input
                type="file"
                accept=".csv,text/csv"
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
              <TableHead>Parent</TableHead>
              <TableHead>Child</TableHead>
              <TableHead>Acct ID</TableHead>
              <TableHead className="text-right">7d Spend</TableHead>
              <TableHead className="text-right">QTD</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.slice(0, 50).map((r) => (
              <TableRow key={r.rowIndex}>
                <TableCell className="text-muted-foreground">{r.rowIndex}</TableCell>
                <TableCell>{r.parentCompany}</TableCell>
                <TableCell>{r.childCompany}</TableCell>
                <TableCell className="font-mono text-xs">{r.linkedinAccountId}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCents(r.last7dSpendCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCents(r.qtdSpendCents)}
                </TableCell>
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
