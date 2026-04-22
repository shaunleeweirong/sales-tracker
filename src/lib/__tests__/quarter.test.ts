import { describe, it, expect } from "vitest";
import {
  currentQuarter,
  currentQuarterLabel,
  quarterStart,
  quarterEnd,
  daysRemainingInQuarter,
  daysElapsedInQuarter,
  totalDaysInQuarter,
} from "../quarter";

describe("quarter helpers", () => {
  it("labels Q2 2026 correctly", () => {
    const d = new Date("2026-04-21T12:00:00Z");
    expect(currentQuarter(d)).toEqual({ year: 2026, q: 2 });
    expect(currentQuarterLabel(d)).toBe("2026-Q2");
  });

  it("Q1 starts Jan 1 and Q1 ends Mar 31", () => {
    const d = new Date("2026-02-14T00:00:00Z");
    expect(quarterStart(d).toISOString().slice(0, 10)).toBe("2026-01-01");
    expect(quarterEnd(d).toISOString().slice(0, 10)).toBe("2026-03-31");
  });

  it("Q2 starts Apr 1 and Q2 ends Jun 30", () => {
    const d = new Date("2026-04-21T00:00:00Z");
    expect(quarterStart(d).toISOString().slice(0, 10)).toBe("2026-04-01");
    expect(quarterEnd(d).toISOString().slice(0, 10)).toBe("2026-06-30");
  });

  it("Q4 ends Dec 31", () => {
    const d = new Date("2026-11-15T00:00:00Z");
    expect(quarterEnd(d).toISOString().slice(0, 10)).toBe("2026-12-31");
  });

  it("daysRemainingInQuarter is 1 on the last day", () => {
    const d = new Date("2026-06-30T12:00:00Z");
    expect(daysRemainingInQuarter(d)).toBe(1);
  });

  it("daysRemainingInQuarter is 71 on Apr 21 2026", () => {
    // Apr 21 → Jun 30 = 10 (Apr) + 31 (May) + 30 (Jun) = 71
    const d = new Date("2026-04-21T00:00:00Z");
    expect(daysRemainingInQuarter(d)).toBe(71);
  });

  it("daysElapsedInQuarter on the first day", () => {
    const d = new Date("2026-04-01T00:00:00Z");
    expect(daysElapsedInQuarter(d)).toBe(1);
  });

  it("totalDaysInQuarter for Q1 (non-leap)", () => {
    const d = new Date("2026-02-14T00:00:00Z");
    expect(totalDaysInQuarter(d)).toBe(90); // 31+28+31
  });

  it("totalDaysInQuarter for Q2", () => {
    const d = new Date("2026-04-21T00:00:00Z");
    expect(totalDaysInQuarter(d)).toBe(91); // 30+31+30
  });
});
