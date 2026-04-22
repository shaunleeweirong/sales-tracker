import { createClient } from "@/lib/supabase/server";
import { getUserAndProfile } from "@/lib/auth";
import { StatTile } from "@/components/stat-tile";
import { PacingGauge } from "@/components/pacing-gauge";
import { formatCents, formatCentsAbbrev } from "@/lib/forecast";
import { currentQuarterLabel, daysRemainingInQuarter } from "@/lib/quarter";
import { QuotaEditor } from "./quota-editor";
import { RepSelect } from "./rep-select";

type Search = Promise<{ userId?: string }>;

type PacingRow = {
  user_id: string;
  full_name: string | null;
  team_name: string | null;
  quarter: string;
  quota_cents: number;
  qtd_revenue_cents: number;
  projected_revenue_cents: number;
  projected_vs_quota_pct: number | null;
  weighted_pipeline_cents: number;
};

type BucketBreakdown = {
  probability_pct: number;
  weighted_pipeline_cents: number | null;
};

export default async function DashboardPage({ searchParams }: { searchParams: Search }) {
  const { profile, userId: selfId } = await getUserAndProfile();
  const params = await searchParams;
  const targetUserId = profile.role === "admin" && params.userId ? params.userId : selfId;

  const supabase = await createClient();
  const quarter = currentQuarterLabel();
  const daysLeft = daysRemainingInQuarter();

  const { data: pacing } = await supabase
    .from("v_rep_pacing")
    .select("*")
    .eq("user_id", targetUserId)
    .eq("quarter", quarter)
    .maybeSingle<PacingRow>();

  const quotaCents = pacing?.quota_cents ?? 0;
  const qtdCents = pacing?.qtd_revenue_cents ?? 0;
  const projectedCents = pacing?.projected_revenue_cents ?? 0;
  const pacePct = pacing?.projected_vs_quota_pct ?? null;
  const weightedOpen = pacing?.weighted_pipeline_cents ?? 0;
  const weightedPct = quotaCents > 0 ? (weightedOpen / quotaCents) * 100 : null;
  const dailyRunRate = Math.round((projectedCents - qtdCents) / Math.max(1, daysLeft));

  // Bucket breakdown for this rep
  const { data: buckets } = await supabase
    .from("v_opportunities_weighted")
    .select("probability_pct, weighted_pipeline_cents")
    .eq("owner_user_id", targetUserId)
    .returns<BucketBreakdown[]>();

  const byBucket = new Map<number, number>();
  (buckets ?? []).forEach((r) => {
    byBucket.set(
      r.probability_pct,
      (byBucket.get(r.probability_pct) ?? 0) + (r.weighted_pipeline_cents ?? 0),
    );
  });

  let reps: { id: string; full_name: string | null }[] = [];
  if (profile.role === "admin") {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name")
      .order("full_name", { ascending: true });
    reps = data ?? [];
  }

  const displayName = pacing?.full_name ?? profile.full_name ?? "—";
  const teamName = pacing?.team_name ?? "—";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {displayName} · Team {teamName} · {quarter} · {daysLeft} days remaining
          </p>
        </div>
        {profile.role === "admin" && <RepSelect reps={reps} selected={targetUserId} />}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="Quota"
          value={formatCents(quotaCents)}
          sublabel={
            <QuotaEditor
              userId={targetUserId}
              quarter={quarter}
              currentCents={quotaCents}
            />
          }
        />
        <StatTile
          label="QTD Revenue"
          value={formatCents(qtdCents)}
          sublabel={
            quotaCents > 0
              ? `${Math.round((qtdCents / quotaCents) * 100)}% of quota`
              : "no quota set"
          }
        />
        <StatTile
          label="Run rate / day"
          value={formatCentsAbbrev(dailyRunRate)}
          sublabel="from 7-day pace"
        />
        <StatTile
          label="STLP EOQ"
          value={formatCents(projectedCents)}
          sublabel={
            pacePct != null
              ? `${pacePct.toFixed(0)}% of quota`
              : quotaCents === 0
                ? "no quota set"
                : ""
          }
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border bg-background p-4">
          <div className="text-sm font-medium mb-3">Straight-line Pacing vs Quota (STLP)</div>
          <PacingGauge pct={pacePct} />
        </div>
        <div className="rounded-lg border bg-background p-4">
          <div className="text-sm font-medium mb-3">Weighted Pipeline vs Quota</div>
          <PacingGauge pct={weightedPct} label="Weighted pipeline" />
        </div>
      </div>

      <div className="rounded-lg border bg-background p-4">
        <div className="text-sm font-medium mb-3">Open Weighted Pipeline</div>
        {(() => {
          const probs = [100, 90, 75, 50, 25, 10, 5];
          const values = probs.map((p) => byBucket.get(p) ?? 0);
          const maxCents = Math.max(1, ...values);
          return (
            <div className="flex flex-col">
              <div className="grid grid-cols-[60px_1fr_120px] gap-3 text-xs text-muted-foreground pb-2 border-b">
                <div>Probability</div>
                <div>Pipeline share</div>
                <div className="text-right">Amount</div>
              </div>
              {probs.map((p, i) => {
                const cents = values[i];
                const pctWidth = (cents / maxCents) * 100;
                const isZero = cents === 0;
                return (
                  <div
                    key={p}
                    className="grid grid-cols-[60px_1fr_120px] gap-3 items-center py-2 text-sm border-b last:border-b-0"
                  >
                    <div className={isZero ? "text-muted-foreground" : "font-medium"}>{p}%</div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      {!isZero && (
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${pctWidth}%` }}
                        />
                      )}
                    </div>
                    <div
                      className={
                        "text-right tabular-nums " +
                        (isZero ? "text-muted-foreground" : "font-semibold")
                      }
                    >
                      {formatCentsAbbrev(cents)}
                    </div>
                  </div>
                );
              })}
              <div className="grid grid-cols-[60px_1fr_120px] gap-3 items-center pt-3 mt-1 border-t text-sm">
                <div className="col-span-2 font-medium">Total weighted</div>
                <div className="text-right tabular-nums font-semibold">
                  {formatCents(weightedOpen)}
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
