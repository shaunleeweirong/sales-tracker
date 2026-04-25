import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { OpportunityForm } from "../opportunity-form";
import { loadFormData } from "../load";

type Search = Promise<{ companyId?: string }>;

export default async function NewOpportunityPage({ searchParams }: { searchParams: Search }) {
  const { profile } = await getUserAndProfile();
  const params = await searchParams;
  const supabase = await createClient();
  const { companies, owners, adAccountsByCompany } = await loadFormData(supabase);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">New Opportunity</h1>
      <OpportunityForm
        initial={{
          name: "",
          parentCompanyId: params.companyId ?? "",
          ownerUserId: profile.id,
          forecastedCents: 0,
          probabilityPct: 25,
          expectedCloseDate: null,
          notes: null,
          goToMarketNotes: null,
          rolesAndResponsibilities: null,
          adAccountId: null,
        }}
        companies={companies}
        owners={owners}
        adAccountsByCompany={adAccountsByCompany}
      />
    </div>
  );
}
