import { describe, it, expect } from "vitest";
import {
  weightedPipelineCents,
  dailyRunRateCents,
  projectedEoqSpendCents,
  projectionVsTargetPct,
  formatCents,
  formatCentsAbbrev,
  pacingStatus,
  PROBABILITY_BUCKETS,
} from "../forecast";

describe("weightedPipelineCents", () => {
  it.each(PROBABILITY_BUCKETS)("computes weighted pipeline at %d%%", (p) => {
    expect(weightedPipelineCents(10_000_00, p)).toBe(Math.round((10_000_00 * p) / 100));
  });

  it("rounds half to nearest integer", () => {
    // 33333 * 75 / 100 = 24999.75 → 25000
    expect(weightedPipelineCents(33333, 75)).toBe(25000);
  });
});

describe("dailyRunRateCents", () => {
  it("divides 7-day spend by 7", () => {
    expect(dailyRunRateCents(7000)).toBe(1000);
  });
  it("rounds fractional cents", () => {
    expect(dailyRunRateCents(100)).toBe(Math.round(100 / 7));
  });
});

describe("projectedEoqSpendCents", () => {
  it("adds qtd + run-rate * days_remaining", () => {
    // 1000c qtd, 700c/7 = 100c/day, 30 days → 1000 + 3000 = 4000
    expect(projectedEoqSpendCents(1000, 700, 30)).toBe(4000);
  });

  it("equals qtd on last day of quarter", () => {
    expect(projectedEoqSpendCents(50_000, 7_000, 0)).toBe(50_000);
  });
});

describe("projectionVsTargetPct", () => {
  it("returns null for zero or missing target", () => {
    expect(projectionVsTargetPct(50_000, 0)).toBeNull();
    expect(projectionVsTargetPct(50_000, null)).toBeNull();
  });
  it("returns one decimal percentage", () => {
    expect(projectionVsTargetPct(645_230_00, 500_000_00)).toBe(129.0);
    expect(projectionVsTargetPct(123_456, 1_000_000)).toBe(12.3);
  });
});

describe("formatters", () => {
  it("formatCents", () => {
    expect(formatCents(123_456_00)).toMatch(/\$123,456/);
  });
  it("formatCentsAbbrev k", () => {
    expect(formatCentsAbbrev(45_000_00)).toBe("$45k");
  });
  it("formatCentsAbbrev M", () => {
    expect(formatCentsAbbrev(2_500_000_00)).toBe("$2.5M");
  });
});

describe("pacingStatus", () => {
  it("classifies zones", () => {
    expect(pacingStatus(null)).toBe("unknown");
    expect(pacingStatus(50)).toBe("off-track");
    expect(pacingStatus(85)).toBe("at-risk");
    expect(pacingStatus(110)).toBe("on-track");
  });
});
