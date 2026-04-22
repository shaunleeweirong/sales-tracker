export const PROBABILITY_BUCKETS = [5, 10, 25, 50, 75, 90, 100] as const;
export type ProbabilityBucket = (typeof PROBABILITY_BUCKETS)[number];

export function weightedPipelineCents(forecastCents: number, probabilityPct: number): number {
  return Math.round((forecastCents * probabilityPct) / 100);
}

export function dailyRunRateCents(last7dSpendCents: number): number {
  return Math.round(last7dSpendCents / 7);
}

export function projectedEoqSpendCents(
  qtdSpendCents: number,
  last7dSpendCents: number,
  daysRemaining: number,
): number {
  return qtdSpendCents + dailyRunRateCents(last7dSpendCents) * daysRemaining;
}

export function projectionVsTargetPct(
  projectedCents: number,
  targetCents: number | null | undefined,
): number | null {
  if (!targetCents || targetCents === 0) return null;
  return Math.round((1000 * projectedCents) / targetCents) / 10; // one decimal
}

export function projectedVsQuotaPct(
  projectedCents: number,
  quotaCents: number | null | undefined,
): number | null {
  return projectionVsTargetPct(projectedCents, quotaCents);
}

export function formatCents(cents: number): string {
  const dollars = cents / 100;
  return dollars.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatCentsAbbrev(cents: number): string {
  const n = cents / 100;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${n.toFixed(0)}`;
}

export function pacingStatus(pct: number | null): "on-track" | "at-risk" | "off-track" | "unknown" {
  if (pct == null) return "unknown";
  if (pct >= 100) return "on-track";
  if (pct >= 80) return "at-risk";
  return "off-track";
}
