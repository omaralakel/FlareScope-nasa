import type { Range } from '../data/schema';

/** At most one decimal, trailing ".0" dropped: 10.1771 -> "10.2", 39.97 -> "40". */
export function fmtNum(v: number): string {
  return String(Math.round(v * 10) / 10);
}

/** Gravity in g: up to 3 decimals, no trailing zeros: 0.166 -> "0.166", 1 -> "1", 0.38 -> "0.38". */
export function fmtG(v: number): string {
  return String(Math.round(v * 1000) / 1000);
}

/** "12–34% O₂" style range; a single value when min equals max after rounding. */
export function fmtRange(r: Range, unit: string): string {
  const lo = fmtNum(r.min);
  const hi = fmtNum(r.max);
  return lo === hi ? `${lo}${unit}` : `${lo}–${hi}${unit}`;
}

/** Full-precision range for tooltips. */
export function exactRange(r: Range): string {
  return r.min === r.max ? String(r.min) : `${r.min}–${r.max}`;
}
