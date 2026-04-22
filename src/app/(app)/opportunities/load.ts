import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db";

export async function loadFormData(supabase: SupabaseClient<Database>) {
  const [{ data: companies }, { data: owners }, { data: teams }, { data: accounts }] =
    await Promise.all([
      supabase.from("parent_companies").select("id, name").order("name"),
      supabase.from("profiles").select("id, full_name").order("full_name"),
      supabase.from("teams").select("id, name").order("name"),
      supabase
        .from("ad_accounts")
        .select("id, parent_company_id, linkedin_account_id")
        .order("linkedin_account_id"),
    ]);

  const adAccountsByCompany: Record<string, { id: string; linkedin_account_id: string }[]> = {};
  for (const a of accounts ?? []) {
    (adAccountsByCompany[a.parent_company_id] ??= []).push({
      id: a.id,
      linkedin_account_id: a.linkedin_account_id,
    });
  }

  return {
    companies: (companies ?? []).map((c) => ({ id: c.id, label: c.name })),
    owners: (owners ?? []).map((o) => ({ id: o.id, label: o.full_name ?? o.id.slice(0, 6) })),
    teams: (teams ?? []).map((t) => ({ id: t.id, label: t.name })),
    adAccountsByCompany,
  };
}
