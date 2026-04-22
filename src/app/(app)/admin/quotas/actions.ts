"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export async function saveQuotaAdmin(
  updates: { userId: string; quarter: string; quotaCents: number }[],
) {
  await requireAdmin();
  const supabase = await createClient();
  const rows = updates.map((u) => ({
    user_id: u.userId,
    quarter: u.quarter,
    quota_cents: u.quotaCents,
  }));
  const { error } = await supabase
    .from("user_quotas")
    .upsert(rows, { onConflict: "user_id,quarter" });
  if (error) return { error: error.message };
  return { ok: true };
}
