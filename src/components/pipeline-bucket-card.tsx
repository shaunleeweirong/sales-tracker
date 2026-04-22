import { Card, CardContent } from "@/components/ui/card";
import { formatCentsAbbrev } from "@/lib/forecast";

export function PipelineBucketCard({
  probabilityPct,
  count,
  forecastedCents,
  weightedCents,
}: {
  probabilityPct: number;
  count: number;
  forecastedCents: number;
  weightedCents: number;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-center">
          <div className="text-lg font-bold">{probabilityPct}%</div>
          <div className="text-xs text-muted-foreground">{count} opps</div>
        </div>
        <div className="mt-2 flex flex-col gap-1 text-center">
          <div>
            <div className="text-xs text-muted-foreground">Forecasted</div>
            <div className="tabular-nums">{formatCentsAbbrev(forecastedCents)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Weighted</div>
            <div className="font-semibold tabular-nums">{formatCentsAbbrev(weightedCents)}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
