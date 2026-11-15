import type { Investigation, Pillar } from '../data/schema';
import type { Habitat } from './habitats';

export type ScoreFactors = { conditionMatch: number; pillarMatch: number; materialMatch: number };
export type Weights = { condition: number; pillar: number; material: number };
export const DEFAULT_WEIGHTS: Weights = { condition: 0.5, pillar: 0.3, material: 0.2 };

const PILLARS: Pillar[] = ['prevention', 'detection', 'suppression'];
const MATERIAL: Record<Investigation['fuelPhase'], number> = {
  solid: 1,
  gas: 0.6,
  liquid: 0.4,
  aerosol: 0.3,
};

const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

function part(x: number, r: { min: number; max: number }, scale: number): number {
  if (x >= r.min && x <= r.max) return 1;
  const d = x < r.min ? r.min - x : x - r.max;
  return Math.exp(-d / scale);
}

function conditionMatch(inv: Investigation, h: Habitat): number {
  const o2 = inv.o2Percent.value;
  if (!o2) return 0;
  const o2Part = part(h.o2Percent, o2, 10);
  const psi = inv.pressurePsi.value;
  if (!psi) return clamp01(o2Part);
  return clamp01(0.7 * o2Part + 0.3 * part(h.pressurePsi, psi, 3));
}

export function scoreInvestigation(
  inv: Investigation,
  h: Habitat,
  w: Weights = DEFAULT_WEIGHTS,
): { total: number; factors: ScoreFactors } {
  const factors: ScoreFactors = {
    conditionMatch: conditionMatch(inv, h),
    pillarMatch: clamp01(PILLARS.filter((p) => inv.pillars.includes(p)).length / PILLARS.length),
    materialMatch: MATERIAL[inv.fuelPhase] ?? 0,
  };
  const total = clamp01(
    w.condition * factors.conditionMatch + w.pillar * factors.pillarMatch + w.material * factors.materialMatch,
  );
  return { total, factors };
}

export function rankInvestigations(invs: Investigation[], h: Habitat, w: Weights = DEFAULT_WEIGHTS) {
  return invs
    .map((inv) => ({ inv, ...scoreInvestigation(inv, h, w) }))
    .sort((a, b) => b.total - a.total || a.inv.name.localeCompare(b.inv.name));
}

export type RankedRow = ReturnType<typeof rankInvestigations>[number];

/** Scales weights so they sum to 1; falls back to DEFAULT_WEIGHTS when the sum is 0 (or invalid). */
export function normalizeWeights(w: Weights): Weights {
  const c = Math.max(0, w.condition) || 0;
  const p = Math.max(0, w.pillar) || 0;
  const m = Math.max(0, w.material) || 0;
  const sum = c + p + m;
  if (!(sum > 0) || !Number.isFinite(sum)) return { ...DEFAULT_WEIGHTS };
  return { condition: c / sum, pillar: p / sum, material: m / sum };
}
