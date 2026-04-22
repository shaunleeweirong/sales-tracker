"use server";

import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";

export async function createTeam(name: string) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("teams").insert({ name });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function assignRep(userId: string, teamId: string | null) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ team_id: teamId })
    .eq("id", userId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function setRole(userId: string, role: "rep" | "admin") {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: error.message };
  return { ok: true };
}
