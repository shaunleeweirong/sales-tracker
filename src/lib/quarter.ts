export function currentQuarter(now: Date = new Date()): { year: number; q: 1 | 2 | 3 | 4 } {
  const q = (Math.floor(now.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  return { year: now.getUTCFullYear(), q };
}

export function currentQuarterLabel(now: Date = new Date()): string {
  const { year, q } = currentQuarter(now);
  return `${year}-Q${q}`;
}

export function quarterStart(now: Date = new Date()): Date {
  const { year, q } = currentQuarter(now);
  return new Date(Date.UTC(year, (q - 1) * 3, 1));
}

export function quarterEnd(now: Date = new Date()): Date {
  const { year, q } = currentQuarter(now);
  return new Date(Date.UTC(year, q * 3, 0, 23, 59, 59, 999));
}

export function daysRemainingInQuarter(now: Date = new Date()): number {
  const end = quarterEnd(now);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const ms = end.getTime() - today.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000) + 1);
}

export function daysElapsedInQuarter(now: Date = new Date()): number {
  const start = quarterStart(now);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.floor((today.getTime() - start.getTime()) / 86_400_000) + 1;
}

export function totalDaysInQuarter(now: Date = new Date()): number {
  const start = quarterStart(now);
  const end = quarterEnd(now);
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}
