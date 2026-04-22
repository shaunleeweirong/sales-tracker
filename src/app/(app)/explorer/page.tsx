import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { ExplorerTable } from "./explorer-table";

export default async function ExplorerPage() {
  await getUserAndProfile();
  const supabase = await createClient();

  const [
    { data: companies },
    { data: accounts },
    { data: opps },
    { data: children },
    { data: profiles },
  ] = await Promise.all([
    supabase
      .from("parent_companies")
      .select("id, name, target_revenue_cents")
      .order("name"),
    supabase
      .from("v_ad_account_forecast")
      .select(
        "id, linkedin_account_id, parent_company_id, child_company_id, last_7d_spend_cents, daily_run_rate_cents, qtd_spend_cents, projected_eoq_spend_cents",
      ),
    supabase
      .from("v_opportunities_weighted")
      .select(
        "id, name, probability_pct, forecasted_pipeline_cents, weighted_pipeline_cents, expected_close_date, parent_company_id, ad_account_id, owner_user_id",
      ),
    supabase.from("child_companies").select("id, name"),
    supabase.from("profiles").select("id, full_name"),
  ]);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold">Explorer</h1>
        <p className="text-sm text-muted-foreground">
          Company → Ad Account → Opportunity. Click any row to expand.
        </p>
      </div>
      <ExplorerTable
        companies={companies ?? []}
        accounts={(accounts ?? []).map((a) => ({
          id: a.id ?? "",
          linkedin_account_id: a.linkedin_account_id ?? "",
          parent_company_id: a.parent_company_id ?? "",
          child_company_id: a.child_company_id,
          last_7d_spend_cents: a.last_7d_spend_cents ?? 0,
          daily_run_rate_cents: a.daily_run_rate_cents ?? 0,
          qtd_spend_cents: a.qtd_spend_cents ?? 0,
          projected_eoq_spend_cents: a.projected_eoq_spend_cents ?? 0,
        }))}
        opps={(opps ?? []).map((o) => ({
          id: o.id ?? "",
          name: o.name ?? "",
          probability_pct: o.probability_pct ?? 0,
          forecasted_pipeline_cents: o.forecasted_pipeline_cents ?? 0,
          weighted_pipeline_cents: o.weighted_pipeline_cents ?? 0,
          expected_close_date: o.expected_close_date,
          parent_company_id: o.parent_company_id ?? "",
          ad_account_id: o.ad_account_id ?? "",
          owner_user_id: o.owner_user_id,
        }))}
        childCompanies={children ?? []}
        profiles={profiles ?? []}
      />
    </div>
  );
}
