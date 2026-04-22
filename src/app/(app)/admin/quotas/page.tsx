import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { currentQuarterLabel } from "@/lib/quarter";
import { QuotaGrid } from "./quota-grid";

type Search = Promise<{ quarter?: string }>;

export default async function QuotasPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const params = await searchParams;
  const quarter = params.quarter ?? currentQuarterLabel();
  const supabase = await createClient();

  const [{ data: reps }, { data: quotas }, { data: teams }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, team_id").order("full_name"),
    supabase.from("user_quotas").select("user_id, quarter, quota_cents").eq("quarter", quarter),
    supabase.from("teams").select("id, name"),
  ]);
  const teamMap = new Map((teams ?? []).map((t) => [t.id, t.name]));
  const quotaMap = new Map((quotas ?? []).map((q) => [q.user_id, q.quota_cents]));

  const rows = (reps ?? []).map((r) => ({
    userId: r.id,
    name: r.full_name ?? r.id.slice(0, 6),
    team: r.team_id ? teamMap.get(r.team_id) ?? "—" : "—",
    quotaCents: quotaMap.get(r.id) ?? 0,
  }));

  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Per-rep quarterly quota</h1>
        <p className="text-sm text-muted-foreground">
          Editing <span className="font-medium">{quarter}</span>.
        </p>
      </div>
      <QuotaGrid quarter={quarter} rows={rows} />
    </div>
  );
}
