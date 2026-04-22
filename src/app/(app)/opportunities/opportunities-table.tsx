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
import { Badge } from "@/components/ui/badge";
import { formatCentsAbbrev } from "@/lib/forecast";

export type OppRow = {
  id: string;
  name: string;
  probability_pct: number;
  forecasted_pipeline_cents: number;
  weighted_pipeline_cents: number;
  expected_close_date: string | null;
  parent_company_id: string | null;
  parent_company_name: string | null;
  owner_user_id: string | null;
  owner_name: string | null;
  ad_account_linkedin_id: string | null;
};

export function OpportunitiesTable({ rows }: { rows: OppRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return rows;
    return rows.filter((r) => {
      const haystack = [
        r.name,
        r.parent_company_name ?? "",
        r.owner_name ?? "",
        r.ad_account_linkedin_id ?? "",
        r.expected_close_date ?? "",
        `${r.probability_pct}%`,
      ]
        .join(" ")
        .toLowerCase();
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
          placeholder="Search opportunities, companies, owners, ad accounts…"
          className="pl-8 h-9"
        />
      </div>

      <div className="rounded-lg border bg-background overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Opportunity</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Ad Account ID</TableHead>
              <TableHead className="text-center">%</TableHead>
              <TableHead className="text-right">Forecast</TableHead>
              <TableHead className="text-right">Weighted</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Close</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((o) => (
              <TableRow key={o.id} className="hover:bg-accent/30">
                <TableCell>
                  <Link href={`/opportunities/${o.id}/edit`} className="font-medium hover:underline">
                    {o.name}
                  </Link>
                </TableCell>
                <TableCell>
                  {o.parent_company_id ? (
                    <Link
                      href={`/companies/${o.parent_company_id}`}
                      className="text-muted-foreground hover:underline"
                    >
                      {o.parent_company_name ?? "—"}
                    </Link>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell>
                  {o.ad_account_linkedin_id ? (
                    <span className="font-mono text-xs rounded bg-muted px-1.5 py-0.5">
                      {o.ad_account_linkedin_id}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{o.probability_pct}%</Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCentsAbbrev(o.forecasted_pipeline_cents)}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCentsAbbrev(o.weighted_pipeline_cents)}
                </TableCell>
                <TableCell>{o.owner_name ?? "—"}</TableCell>
                <TableCell>{o.expected_close_date ?? "—"}</TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-10">
                  {query ? `No matches for "${query}".` : "No opportunities."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
