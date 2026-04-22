import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { OpportunitiesTable, type OppRow } from "./opportunities-table";

type Search = Promise<{ owner?: string; team?: string }>;

export default async function OpportunitiesPage({ searchParams }: { searchParams: Search }) {
  await getUserAndProfile();
  const params = await searchParams;
  const supabase = await createClient();

  let q = supabase
    .from("v_opportunities_weighted")
    .select(
      "id, name, probability_pct, forecasted_pipeline_cents, weighted_pipeline_cents, expected_close_date, parent_company_id, owner_user_id, team_id, ad_account_linkedin_id",
    );
  if (params.owner) q = q.eq("owner_user_id", params.owner);
  if (params.team) q = q.eq("team_id", params.team);

  const { data: opps } = await q.order("expected_close_date", { ascending: true });

  const [{ data: companies }, { data: owners }] = await Promise.all([
    supabase.from("parent_companies").select("id, name"),
    supabase.from("profiles").select("id, full_name"),
  ]);
  const companyMap = new Map((companies ?? []).map((c) => [c.id, c.name]));
  const ownerMap = new Map((owners ?? []).map((o) => [o.id, o.full_name ?? o.id.slice(0, 6)]));

  const rows: OppRow[] = (opps ?? []).map((o) => ({
    id: o.id!,
    name: o.name ?? "",
    probability_pct: o.probability_pct ?? 0,
    forecasted_pipeline_cents: o.forecasted_pipeline_cents ?? 0,
    weighted_pipeline_cents: o.weighted_pipeline_cents ?? 0,
    expected_close_date: o.expected_close_date,
    parent_company_id: o.parent_company_id,
    parent_company_name: o.parent_company_id ? (companyMap.get(o.parent_company_id) ?? null) : null,
    owner_user_id: o.owner_user_id,
    owner_name: o.owner_user_id ? (ownerMap.get(o.owner_user_id) ?? null) : null,
    ad_account_linkedin_id: o.ad_account_linkedin_id,
  }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Opportunities</h1>
          <p className="text-sm text-muted-foreground">{rows.length} opportunities</p>
        </div>
        <Button size="sm" render={<Link href="/opportunities/new" />}>+ New Opportunity</Button>
      </div>

      <OpportunitiesTable rows={rows} />
    </div>
  );
}
