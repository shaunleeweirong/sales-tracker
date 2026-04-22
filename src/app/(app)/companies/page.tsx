import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { NewParentDialog } from "./new-parent-dialog";
import { CompaniesTable, type CompanyRow } from "./companies-table";

type Forecast = {
  id: string;
  parent_company_id: string;
  parent_company_name: string;
  child_company_id: string | null;
  qtd_spend_cents: number;
  target_revenue_cents: number | null;
};

export default async function CompaniesPage() {
  await getUserAndProfile();
  const supabase = await createClient();

  const [{ data: rows }, { data: childCounts }, { data: oppRows }] = await Promise.all([
    supabase
      .from("v_ad_account_forecast")
      .select(
        "id, parent_company_id, parent_company_name, child_company_id, qtd_spend_cents, target_revenue_cents",
      )
      .returns<Forecast[]>(),
    supabase.from("child_companies").select("parent_company_id"),
    supabase
      .from("v_opportunities_weighted")
      .select("parent_company_id, weighted_pipeline_cents"),
  ]);

  const weightedByCompany = new Map<string, number>();
  for (const o of oppRows ?? []) {
    if (!o.parent_company_id) continue;
    weightedByCompany.set(
      o.parent_company_id,
      (weightedByCompany.get(o.parent_company_id) ?? 0) + (o.weighted_pipeline_cents ?? 0),
    );
  }

  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      target: number | null;
      accounts: number;
      qtd: number;
      weighted: number;
      childIds: Set<string>;
    }
  >();
  for (const r of rows ?? []) {
    const g = groups.get(r.parent_company_id) ?? {
      id: r.parent_company_id,
      name: r.parent_company_name,
      target: r.target_revenue_cents,
      accounts: 0,
      qtd: 0,
      weighted: weightedByCompany.get(r.parent_company_id) ?? 0,
      childIds: new Set<string>(),
    };
    g.accounts += 1;
    g.qtd += r.qtd_spend_cents;
    if (r.child_company_id) g.childIds.add(r.child_company_id);
    groups.set(r.parent_company_id, g);
  }

  const childrenByParent = new Map<string, number>();
  (childCounts ?? []).forEach((r) => {
    childrenByParent.set(r.parent_company_id, (childrenByParent.get(r.parent_company_id) ?? 0) + 1);
  });

  const all: CompanyRow[] = Array.from(groups.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((g) => ({
      id: g.id,
      name: g.name,
      target: g.target,
      accounts: g.accounts,
      qtd: g.qtd,
      weighted: g.weighted,
      children: childrenByParent.get(g.id) ?? g.childIds.size,
    }));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Companies</h1>
          <p className="text-sm text-muted-foreground">
            {all.length} parent companies · {(rows ?? []).length} ad accounts
          </p>
        </div>
        <NewParentDialog />
      </div>

      <CompaniesTable rows={all} />
    </div>
  );
}
