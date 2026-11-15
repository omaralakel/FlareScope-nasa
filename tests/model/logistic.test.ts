import { describe, expect, it } from 'vitest';
import raw from '../../src/data/investigations.json';
import { loadDataset } from '../../src/data/loadData';
import type { TestPoint } from '../../src/data/schema';
import { boundaryIsMeaningful, boundaryO2, fitLogistic, predictBurn } from '../../src/model/logistic';

function pt(o2: number, psi: number | null, outcome: TestPoint['outcome'], extra: Partial<TestPoint> = {}): TestPoint {
  return {
    investigationId: 'inv-a',
    o2Percent: o2,
    o2Basis: 'ambient',
    pressurePsi: psi,
    flowCmS: null,
    fuel: 'x',
    outcome,
    source: 's',
    ...extra,
  };
}

/** Deterministic grid: burns above 18% O2 at pressures 5, 10, 14.7. */
function synthetic(): TestPoint[] {
  const out: TestPoint[] = [];
  for (const psi of [5, 10, 14.7]) {
    for (let o2 = 10; o2 <= 26; o2 += 1) {
      out.push(pt(o2, psi, o2 > 18 ? 'burned' : 'no_ignition'));
    }
  }
  return out;
}

describe('logistic flammability model', () => {
  it('returns null for 5 points', () => {
    expect(fitLogistic(synthetic().slice(0, 5))).toBeNull();
  });

  it('returns null when all points burned', () => {
    const pts = [15, 18, 21, 25, 30, 40, 50].map((o2) => pt(o2, 10, 'burned'));
    expect(fitLogistic(pts)).toBeNull();
  });

  it('on synthetic data burning above 18% O2, boundaryO2 at 5, 10 and 14.7 psi is within 1.5 of 18', () => {
    const m = fitLogistic(synthetic());
    expect(m).not.toBeNull();
    for (const psi of [5, 10, 14.7]) {
      expect(Math.abs(boundaryO2(m!, psi) - 18.5)).toBeLessThan(1.5);
      expect(Math.abs(boundaryO2(m!, psi) - 18)).toBeLessThan(1.5);
    }
  });

  it('predictBurn increases with O2 at fixed pressure', () => {
    const m = fitLogistic(synthetic())!;
    const a = predictBurn(m, 12, 10);
    const b = predictBurn(m, 18, 10);
    const c = predictBurn(m, 24, 10);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(a).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(1);
  });

  it('ignores points with null pressurePsi', () => {
    const base = synthetic();
    const noisy = [...base, ...[10, 12, 24, 26].map((o2, i) => pt(o2, null, i < 2 ? 'burned' : 'no_ignition'))];
    const m1 = fitLogistic(base)!;
    const m2 = fitLogistic(noisy)!;
    expect(m2.n).toBe(m1.n);
    expect(m2.bO2).toBeCloseTo(m1.bO2, 10);
  });

  it('ignores burner_stream points', () => {
    const base = synthetic();
    const extra = [10, 12].map((o2) => pt(o2, 10, 'burned', { o2Basis: 'burner_stream' }));
    const m = fitLogistic([...base, ...extra])!;
    expect(m.n).toBe(base.length);
    expect(m.b0).toBeCloseTo(fitLogistic(base)!.b0, 10);
  });

  it('ignores extinguished and measured points', () => {
    const base = synthetic();
    const extra = [
      pt(10, 10, 'extinguished'),
      pt(12, 10, 'extinguished'),
      pt(24, 10, 'measured'),
      pt(26, 10, 'measured'),
    ];
    const m = fitLogistic([...base, ...extra])!;
    expect(m.n).toBe(base.length);
    expect(m.bO2).toBeCloseTo(fitLogistic(base)!.bO2, 10);
  });

  it('sourceIds are the sorted distinct investigation ids of used points', () => {
    const pts = synthetic().map((p, i) => ({ ...p, investigationId: i % 2 ? 'b' : 'a' }));
    expect(fitLogistic(pts)!.sourceIds).toEqual(['a', 'b']);
  });

  it('boundaryO2 is NaN when O2 has no positive effect', () => {
    expect(boundaryO2({ b0: 0, bO2: 0, bP: 0.1, n: 10, sourceIds: [], o2Min: 10, o2Max: 30 }, 10)).toBeNaN();
  });

  it('boundaryIsMeaningful is true for the synthetic 18% data', () => {
    const m = fitLogistic(synthetic())!;
    expect(m.o2Min).toBeLessThan(18);
    expect(m.o2Max).toBeGreaterThan(18);
    expect(boundaryIsMeaningful(m)).toBe(true);
  });

  it('boundaryIsMeaningful is false when bO2 <= 0', () => {
    expect(boundaryIsMeaningful({ b0: 0, bO2: -0.1, bP: 0, n: 10, sourceIds: [], o2Min: 10, o2Max: 30 })).toBe(false);
  });

  it('boundaryIsMeaningful is false when the boundary falls outside the observed O2 range', () => {
    // boundary = 50 % O2 at every pressure, but data only spans 10-30 %
    expect(boundaryIsMeaningful({ b0: -5, bO2: 0.1, bP: 0, n: 10, sourceIds: [], o2Min: 10, o2Max: 30 })).toBe(false);
  });

  it('fits the real dataset', () => {
    // Documents a real finding: pooled PSI burn/no-burn tests do not separate by O2
    // (outcomes depend on fuel, flow and geometry), so the app must show
    // "no reliable boundary" rather than draw one.
    const ds = loadDataset(raw);
    const usable = ds.tests.filter(
      (t) =>
        t.o2Basis === 'ambient' &&
        t.pressurePsi !== null &&
        (t.outcome === 'burned' || t.outcome === 'no_ignition'),
    );
    const m = fitLogistic(ds.tests);
    expect(m).not.toBeNull();
    expect(m!.n).toBe(usable.length);
    expect(m!.sourceIds).toEqual(['acme-cfi-g', 'flex']);
    expect(boundaryIsMeaningful(m!)).toBe(false);
  });
});
