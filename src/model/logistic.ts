import type { TestPoint } from '../data/schema';

/** logit(P(burn)) = b0 + bO2 * o2Percent + bP * pressurePsi */
export type FlamModel = {
  b0: number;
  bO2: number;
  bP: number;
  n: number;
  sourceIds: string[];
  /** Observed O2 % range of the points used in the fit. */
  o2Min: number;
  o2Max: number;
};

const LR = 0.1;
const ITERS = 5000;
const LAMBDA = 0.01;
const MIN_POINTS = 6;

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function meanStd(xs: number[]): [number, number] {
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const variance = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length;
  const sd = Math.sqrt(variance);
  return [mean, sd > 1e-12 ? sd : 1];
}

/**
 * Fits a logistic regression on ambient-O2 points with a known pressure.
 * 'burned' = 1, 'no_ignition' = 0. 'extinguished' (a flame existed) and
 * 'measured' (unclassified) are excluded, as are burner_stream points.
 * Returns null with fewer than 6 usable points or only one class.
 */
export function fitLogistic(points: TestPoint[]): FlamModel | null {
  const used = points.filter(
    (p) =>
      p.o2Basis === 'ambient' &&
      p.pressurePsi !== null &&
      (p.outcome === 'burned' || p.outcome === 'no_ignition'),
  );
  if (used.length < MIN_POINTS) return null;
  const y = used.map((p) => (p.outcome === 'burned' ? 1 : 0));
  const pos = y.reduce<number>((a, b) => a + b, 0);
  if (pos === 0 || pos === y.length) return null;

  const o2s = used.map((p) => p.o2Percent);
  const ps = used.map((p) => p.pressurePsi as number);
  const [mo, so] = meanStd(o2s);
  const [mp, sp] = meanStd(ps);
  const xo = o2s.map((v) => (v - mo) / so);
  const xp = ps.map((v) => (v - mp) / sp);
  const n = used.length;

  let w0 = 0;
  let wo = 0;
  let wp = 0;
  for (let it = 0; it < ITERS; it++) {
    let g0 = 0;
    let go = 0;
    let gp = 0;
    for (let i = 0; i < n; i++) {
      const err = sigmoid(w0 + wo * xo[i] + wp * xp[i]) - y[i];
      g0 += err;
      go += err * xo[i];
      gp += err * xp[i];
    }
    w0 -= (LR * g0) / n;
    wo -= LR * (go / n + LAMBDA * wo);
    wp -= LR * (gp / n + LAMBDA * wp);
  }

  const bO2 = wo / so;
  const bP = wp / sp;
  const b0 = w0 - bO2 * mo - bP * mp;
  const sourceIds = [...new Set(used.map((p) => p.investigationId))].sort();
  return { b0, bO2, bP, n, sourceIds, o2Min: Math.min(...o2s), o2Max: Math.max(...o2s) };
}

/** Probability (0..1) that a flame burns at the given O2 % and pressure (psi). */
export function predictBurn(m: FlamModel, o2: number, pressurePsi: number): number {
  return sigmoid(m.b0 + m.bO2 * o2 + m.bP * pressurePsi);
}

/**
 * O2 % at which P(burn) = p (default 0.5) for the given pressure.
 * Returns NaN when bO2 <= 0 (O2 has no positive effect, so no boundary exists);
 * callers must treat NaN as "no boundary". Otherwise returns the raw value, which may lie
 * outside 0..100 or the observed data; callers should gate on boundaryIsMeaningful.
 */
export function boundaryO2(m: FlamModel, pressurePsi: number, p = 0.5): number {
  if (!(m.bO2 > 0)) return NaN;
  const logit = Math.log(p / (1 - p));
  return (logit - m.b0 - m.bP * pressurePsi) / m.bO2;
}

/**
 * True only when bO2 > 0 and, at every given pressure, the 50% boundary is finite and
 * inside the observed O2 range [o2Min, o2Max]. Callers must not draw a boundary when
 * this is false.
 */
export function boundaryIsMeaningful(
  m: FlamModel,
  pressuresPsi: number[] = [4.3, 10.2, 14.7],
): boolean {
  if (!(m.bO2 > 0)) return false;
  return pressuresPsi.every((p) => {
    const b = boundaryO2(m, p);
    return Number.isFinite(b) && b >= m.o2Min && b <= m.o2Max;
  });
}
