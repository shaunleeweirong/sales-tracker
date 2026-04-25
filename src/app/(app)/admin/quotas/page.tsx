import { requireAdmin } from "@/lib/auth";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { currentQuarterLabel } from "@/lib/quarter";
import { QuotaGrid } from "./quota-grid";

type Search = Promise<{ quarter?: string }>;

export default async function QuotasPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin();
  const params = await searchParams;
  const quarter = params.quarter ?? currentQuarterLabel();
  // Admin-only page; bypass RLS to see all reps' quotas.
  const supabase = createServiceRoleClient();

  const [{ data: reps }, { data: quotas }] = await Promise.all([
    supabase.from("profiles").select("id, full_name").order("full_name"),
    supabase.from("user_quotas").select("user_id, quarter, quota_cents").eq("quarter", quarter),
  ]);
  const quotaMap = new Map((quotas ?? []).map((q) => [q.user_id, q.quota_cents]));

  const rows = (reps ?? []).map((r) => ({
    userId: r.id,
    name: r.full_name ?? r.id.slice(0, 6),
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
