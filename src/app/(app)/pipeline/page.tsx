import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PipelineBucketCard } from "@/components/pipeline-bucket-card";
import { formatCents, formatCentsAbbrev, PROBABILITY_BUCKETS } from "@/lib/forecast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { PipelineFilters } from "./filters";
import { getUserAndProfile } from "@/lib/auth";

type Search = Promise<{ owner?: string }>;

type Row = {
  id: string;
  name: string;
  probability_pct: number;
  forecasted_pipeline_cents: number;
  weighted_pipeline_cents: number | null;
  expected_close_date: string | null;
  parent_company_id: string;
  owner_user_id: string | null;
  ad_account_linkedin_id: string | null;
};

export default async function PipelinePage({ searchParams }: { searchParams: Search }) {
  await getUserAndProfile();
  const params = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("v_opportunities_weighted")
    .select(
      "id, name, probability_pct, forecasted_pipeline_cents, weighted_pipeline_cents, expected_close_date, parent_company_id, owner_user_id, ad_account_linkedin_id",
    );
  if (params.owner) q = q.eq("owner_user_id", params.owner);

  const { data: rows } = await q.returns<Row[]>();
  const opps = rows ?? [];

  const [{ data: owners }, { data: companies }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("parent_companies").select("id, name"),
  ]);
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.full_name ?? o.id.slice(0, 6)]));
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name]));

  const byBucket = new Map<number, { count: number; forecast: number; weighted: number }>();
  for (const b of PROBABILITY_BUCKETS) byBucket.set(b, { count: 0, forecast: 0, weighted: 0 });
  let total = 0;
  for (const r of opps) {
    const cell = byBucket.get(r.probability_pct);
    if (!cell) continue;
    cell.count += 1;
    cell.forecast += r.forecasted_pipeline_cents;
    cell.weighted += r.weighted_pipeline_cents ?? 0;
    total += r.weighted_pipeline_cents ?? 0;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Weighted Pipeline</h1>
          <p className="text-sm text-muted-foreground">
            All opportunities by probability bucket
          </p>
        </div>
        <PipelineFilters
          owners={owners ?? []}
          selectedOwner={params.owner}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
        {[...PROBABILITY_BUCKETS].reverse().map((p) => {
          const cell = byBucket.get(p)!;
          return (
            <PipelineBucketCard
              key={p}
              probabilityPct={p}
              count={cell.count}
              forecastedCents={cell.forecast}
              weightedCents={cell.weighted}
            />
          );
        })}
      </div>

      <div className="rounded-lg border bg-background p-4 flex justify-between">
        <span className="text-sm font-medium">Grand total weighted</span>
        <span className="text-xl font-semibold tabular-nums">{formatCents(total)}</span>
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
            {opps.map((o) => (
              <TableRow key={o.id} className="hover:bg-accent/30">
                <TableCell>
                  <Link className="font-medium hover:underline" href={`/opportunities/${o.id}/edit`}>
                    {o.name}
                  </Link>
                </TableCell>
                <TableCell>{companyMap.get(o.parent_company_id) ?? "—"}</TableCell>
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
                  {formatCentsAbbrev(o.weighted_pipeline_cents ?? 0)}
                </TableCell>
                <TableCell>{o.owner_user_id ? ownerMap.get(o.owner_user_id) : "—"}</TableCell>
                <TableCell>{o.expected_close_date ?? "—"}</TableCell>
              </TableRow>
            ))}
            {opps.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  No opportunities match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
