import { cn } from "@/lib/utils";
import { pacingStatus } from "@/lib/forecast";

export function PacingGauge({
  pct,
  label = "Straight-line pacing",
}: {
  pct: number | null;
  label?: string;
}) {
  const status = pacingStatus(pct);
  const display = pct == null ? "—" : `${pct.toFixed(0)}%`;
  const barPct = Math.min(150, Math.max(0, pct ?? 0));

  const color =
    status === "on-track"
      ? "bg-emerald-500"
      : status === "at-risk"
        ? "bg-amber-500"
        : status === "off-track"
          ? "bg-rose-500"
          : "bg-muted-foreground/40";

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0%</span>
        <span>50%</span>
        <span>100%</span>
        <span>150%</span>
      </div>
      <div className="relative h-3 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full transition-all", color)}
          style={{ width: `${(barPct / 150) * 100}%` }}
        />
        <div
          className="absolute top-0 bottom-0 w-px bg-foreground/60"
          style={{ left: `${(100 / 150) * 100}%` }}
          title="quota line"
        />
      </div>
      <div className="text-sm font-medium">
        {label}: <span className="tabular-nums">{display}</span> of quota
      </div>
    </div>
  );
}
