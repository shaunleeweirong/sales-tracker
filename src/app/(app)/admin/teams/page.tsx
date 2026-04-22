import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TeamsManager } from "./teams-manager";

export default async function TeamsPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: teams }, { data: reps }] = await Promise.all([
    supabase.from("teams").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, team_id, role").order("full_name"),
  ]);

  return (
    <div className="flex flex-col gap-4 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Teams</h1>
        <p className="text-sm text-muted-foreground">Create teams and assign reps.</p>
      </div>
      <TeamsManager
        teams={(teams ?? []).map((t) => ({ id: t.id, name: t.name }))}
        reps={(reps ?? []).map((r) => ({
          id: r.id,
          name: r.full_name ?? r.id.slice(0, 6),
          teamId: r.team_id,
          role: r.role,
        }))}
      />
    </div>
  );
}
