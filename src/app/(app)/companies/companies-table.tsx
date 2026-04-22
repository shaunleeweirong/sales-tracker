"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCentsAbbrev } from "@/lib/forecast";

export type CompanyRow = {
  id: string;
  name: string;
  target: number | null;
  accounts: number;
  qtd: number;
  weighted: number;
  children: number;
};

export function CompaniesTable({ rows }: { rows: CompanyRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return rows;
    return rows.filter((r) => {
      const haystack = r.name.toLowerCase();
      return tokens.every((t) => haystack.includes(t));
    });
  }, [query, rows]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-md">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search companies…"
          className="pl-8 h-9"
        />
      </div>

      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Parent Company</TableHead>
              <TableHead className="text-right">Children</TableHead>
              <TableHead className="text-right">Ad Accounts</TableHead>
              <TableHead className="text-right">QTD Spend</TableHead>
              <TableHead className="text-right">Weighted Pipeline</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">% to Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((g) => {
              const pct =
                g.target && g.target > 0 ? Math.round((100 * g.weighted) / g.target) : null;
              return (
                <TableRow key={g.id} className="hover:bg-accent/30">
                  <TableCell>
                    <Link className="font-medium hover:underline" href={`/companies/${g.id}`}>
                      {g.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{g.children}</TableCell>
                  <TableCell className="text-right tabular-nums">{g.accounts}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsAbbrev(g.qtd)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsAbbrev(g.weighted)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {g.target != null ? formatCentsAbbrev(g.target) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {pct != null ? (
                      <span
                        className={
                          pct >= 100
                            ? "text-emerald-600 font-medium"
                            : pct >= 80
                              ? "text-amber-600"
                              : "text-rose-600"
                        }
                      >
                        {pct}%
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-10">
                  {query ? (
                    `No matches for "${query}".`
                  ) : (
                    <>
                      No companies yet. Import a CSV or{" "}
                      <Link href="/admin/import" className="text-primary hover:underline">
                        upload one now
                      </Link>
                    </>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
