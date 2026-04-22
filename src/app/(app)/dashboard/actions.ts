"use server";

import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";

export async function saveQuota(userId: string, quarter: string, quotaCents: number) {
  const { profile, userId: selfId } = await getUserAndProfile();
  if (profile.role !== "admin" && userId !== selfId) {
    return { error: "Not allowed" };
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_quotas")
    .upsert({ user_id: userId, quarter, quota_cents: quotaCents }, { onConflict: "user_id,quarter" });
  if (error) return { error: error.message };
  return { ok: true };
}
