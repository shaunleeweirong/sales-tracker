"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import type { OppFormInitial } from "./opportunity-form";

export async function saveOpportunity(data: OppFormInitial) {
  await getUserAndProfile();
  if (!data.adAccountId) return { error: "An ad account must be selected" };

  const supabase = await createClient();

  const payload = {
    name: data.name.trim(),
    parent_company_id: data.parentCompanyId,
    ad_account_id: data.adAccountId,
    owner_user_id: data.ownerUserId,
    forecasted_pipeline_cents: data.forecastedCents,
    probability_pct: data.probabilityPct,
    expected_close_date: data.expectedCloseDate,
    notes: data.notes,
    go_to_market_notes: data.goToMarketNotes,
    roles_and_responsibilities: data.rolesAndResponsibilities,
  };

  if (data.id) {
    const { error } = await supabase
      .from("opportunities")
      .update(payload)
      .eq("id", data.id);
    if (error) return { error: error.message };
    return { ok: true, id: data.id };
  }

  const { data: created, error } = await supabase
    .from("opportunities")
    .insert(payload)
    .select("id")
    .single();
  if (error || !created) return { error: error?.message ?? "Failed to create" };
  return { ok: true, id: created.id };
}

export async function deleteOpportunity(id: string) {
  await getUserAndProfile();
  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").delete().eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}
