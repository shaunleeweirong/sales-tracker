import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { OpportunityForm } from "../../opportunity-form";
import { loadFormData } from "../../load";

type Params = Promise<{ id: string }>;

export default async function EditOpportunityPage({ params }: { params: Params }) {
  await getUserAndProfile();
  const { id } = await params;
  const supabase = await createClient();

  const { data: opp } = await supabase
    .from("opportunities")
    .select("*")
    .eq("id", id)
    .single();
  if (!opp) notFound();

  const { companies, owners, teams, adAccountsByCompany } = await loadFormData(supabase);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Edit Opportunity</h1>
      <OpportunityForm
        initial={{
          id: opp.id,
          name: opp.name,
          parentCompanyId: opp.parent_company_id,
          ownerUserId: opp.owner_user_id,
          teamId: opp.team_id,
          forecastedCents: opp.forecasted_pipeline_cents,
          probabilityPct: opp.probability_pct,
          expectedCloseDate: opp.expected_close_date,
          notes: opp.notes,
          goToMarketNotes: opp.go_to_market_notes,
          rolesAndResponsibilities: opp.roles_and_responsibilities,
          adAccountId: opp.ad_account_id,
        }}
        companies={companies}
        owners={owners}
        teams={teams}
        adAccountsByCompany={adAccountsByCompany}
      />
    </div>
  );
}
