import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCents, formatCentsAbbrev } from "@/lib/forecast";
import { TargetEditor } from "./target-editor";
import { ChildCompanyAdder } from "./child-adder";

type Params = Promise<{ id: string }>;

export default async function CompanyDetailPage({ params }: { params: Params }) {
  await getUserAndProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: company } = await supabase
    .from("parent_companies")
    .select("id, name, target_revenue_cents")
    .eq("id", id)
    .single();
  if (!company) notFound();

  const [{ data: children }, { data: accounts }, { data: opps }, { data: people }] =
    await Promise.all([
      supabase.from("child_companies").select("id, name").eq("parent_company_id", id).order("name"),
      supabase
        .from("v_ad_account_forecast")
        .select(
          "id, linkedin_account_id, child_company_id, last_7d_spend_cents, qtd_spend_cents, daily_run_rate_cents, projected_eoq_spend_cents",
        )
        .eq("parent_company_id", id),
      supabase
        .from("v_opportunities_weighted")
        .select(
          "id, name, probability_pct, forecasted_pipeline_cents, weighted_pipeline_cents, expected_close_date, owner_user_id, ad_account_linkedin_id",
        )
        .eq("parent_company_id", id)
        .order("expected_close_date", { ascending: true }),
      supabase.from("profiles").select("id, full_name"),
    ]);

  const childMap = new Map((children ?? []).map((c) => [c.id, c.name]));
  const peopleMap = new Map((people ?? []).map((p) => [p.id, p.full_name ?? p.id.slice(0, 6)]));

  const totals = (accounts ?? []).reduce(
    (acc, a) => ({
      qtd: acc.qtd + (a.qtd_spend_cents ?? 0),
      projected: acc.projected + (a.projected_eoq_spend_cents ?? 0),
    }),
    { qtd: 0, projected: 0 },
  );
  const target = company.target_revenue_cents ?? 0;
  const pct = target > 0 ? Math.round((100 * totals.projected) / target) : null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/companies" className="text-sm text-muted-foreground hover:underline">
          ← Companies
        </Link>
        <h1 className="text-2xl font-semibold mt-2">{company.name}</h1>
        <div className="flex gap-6 mt-3 items-center flex-wrap">
          <div>
            <div className="text-xs text-muted-foreground">Quarterly target</div>
            <TargetEditor
              parentId={company.id}
              currentCents={company.target_revenue_cents}
            />
          </div>
          <div>
            <div className="text-xs text-muted-foreground">STLP EOQ spend</div>
            <div className="text-lg font-semibold tabular-nums">
              {formatCents(totals.projected)}
              {pct != null && (
                <span
                  className={`ml-2 text-sm ${
                    pct >= 100
                      ? "text-emerald-600"
                      : pct >= 80
                        ? "text-amber-600"
                        : "text-rose-600"
                  }`}
                >
                  ({pct}%)
                </span>
              )}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">QTD spend</div>
            <div className="text-lg font-semibold tabular-nums">{formatCents(totals.qtd)}</div>
          </div>
        </div>
      </div>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium">Child companies</h2>
          <ChildCompanyAdder parentId={company.id} />
        </div>
        <div className="flex flex-wrap gap-2">
          {(children ?? []).map((c) => (
            <Badge key={c.id} variant="secondary">{c.name}</Badge>
          ))}
          {(children ?? []).length === 0 && (
            <span className="text-sm text-muted-foreground">None yet.</span>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium mb-2">Ad accounts</h2>
        <div className="rounded-lg border bg-background overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>LinkedIn Acct</TableHead>
                <TableHead>Child Co</TableHead>
                <TableHead className="text-right">7d Spend</TableHead>
                <TableHead className="text-right">Run / day</TableHead>
                <TableHead className="text-right">QTD Spend</TableHead>
                <TableHead className="text-right">STLP EOQ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(accounts ?? []).map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-mono text-sm">{a.linkedin_account_id}</TableCell>
                  <TableCell>
                    {a.child_company_id ? childMap.get(a.child_company_id) ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsAbbrev(a.last_7d_spend_cents ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsAbbrev(a.daily_run_rate_cents ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsAbbrev(a.qtd_spend_cents ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCentsAbbrev(a.projected_eoq_spend_cents ?? 0)}
                  </TableCell>
                </TableRow>
              ))}
              {(accounts ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                    No ad accounts imported yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-medium">Opportunities</h2>
          <Button size="sm" render={<Link href={`/opportunities/new?companyId=${company.id}`} />}>
            + New Opportunity
          </Button>
        </div>
        <div className="rounded-lg border bg-background overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Ad Account ID</TableHead>
                <TableHead className="text-center">%</TableHead>
                <TableHead className="text-right">Forecast</TableHead>
                <TableHead className="text-right">Weighted</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Close</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(opps ?? []).map((o) => (
                <TableRow key={o.id} className="hover:bg-accent/30">
                  <TableCell>
                    <Link
                      href={`/opportunities/${o.id}/edit`}
                      className="font-medium hover:underline"
                    >
                      {o.name}
                    </Link>
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
                    {formatCentsAbbrev(o.forecasted_pipeline_cents ?? 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCentsAbbrev(o.weighted_pipeline_cents ?? 0)}
                  </TableCell>
                  <TableCell>
                    {o.owner_user_id ? peopleMap.get(o.owner_user_id) ?? "—" : "—"}
                  </TableCell>
                  <TableCell>{o.expected_close_date ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(opps ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    No opportunities yet.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
