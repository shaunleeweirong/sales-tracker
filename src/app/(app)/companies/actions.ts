"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";

export async function createParent(name: string, targetRevenueCents: number | null) {
  await getUserAndProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("parent_companies")
    .insert({ name, target_revenue_cents: targetRevenueCents });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function updateTarget(parentId: string, targetRevenueCents: number | null) {
  await getUserAndProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("parent_companies")
    .update({ target_revenue_cents: targetRevenueCents })
    .eq("id", parentId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function createChildCompany(parentId: string, name: string) {
  await getUserAndProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("child_companies")
    .insert({ parent_company_id: parentId, name });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function linkAdAccountChild(adAccountId: string, childId: string | null) {
  await getUserAndProfile();
  const supabase = await createClient();
  const { error } = await supabase
    .from("ad_accounts")
    .update({ child_company_id: childId })
    .eq("id", adAccountId);
  if (error) return { error: error.message };
  return { ok: true };
}
