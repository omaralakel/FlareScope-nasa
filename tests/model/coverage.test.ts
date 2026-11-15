import { describe, expect, it } from 'vitest';
import raw from '../../src/data/investigations.json';
import { loadDataset } from '../../src/data/loadData';
import type { TestPoint } from '../../src/data/schema';
import { boundaryEvidence, testsNear } from '../../src/model/coverage';
import { HABITATS } from '../../src/model/habitats';
import { boundaryIsMeaningful, fitLogistic } from '../../src/model/logistic';

function pt(o2: number, psi: number | null, extra: Partial<TestPoint> = {}): TestPoint {
  return {
    investigationId: 'inv-a',
    o2Percent: o2,
    o2Basis: 'ambient',
    pressurePsi: psi,
    flowCmS: null,
    fuel: 'x',
    outcome: 'burned',
    source: 's',
    ...extra,
  };
}

describe('testsNear', () => {
  it('keeps ambient points inside the inclusive box', () => {
    const pts = [pt(30, 10.2), pt(33, 11.7), pt(27, 8.7), pt(33.5, 10.2), pt(30, 11.8)];
    expect(testsNear(pts, 30, 10.2)).toHaveLength(3);
  });

  it('excludes burner-stream points and null pressure', () => {
    const pts = [pt(30, 10.2, { o2Basis: 'burner_stream' }), pt(30, null), pt(30, 10)];
    expect(testsNear(pts, 30, 10.2)).toHaveLength(1);
  });

  it('honours custom tolerances', () => {
    const pts = [pt(25, 10.2), pt(30, 13)];
    expect(testsNear(pts, 30, 10.2)).toHaveLength(0);
    expect(testsNear(pts, 30, 10.2, 5, 3)).toHaveLength(2);
  });

  it('is empty for an empty list', () => {
    expect(testsNear([], 21, 14.7)).toEqual([]);
  });
});

describe('real dataset coverage', () => {
  const ds = loadDataset(raw);

  it('counts tests near each habitat', () => {
    const near = (id: keyof typeof HABITATS) =>
      testsNear(ds.tests, HABITATS[id].o2Percent, HABITATS[id].pressurePsi).length;
    expect(near('iss')).toBe(223);
    expect(near('moon')).toBe(8);
    expect(near('suit')).toBe(0);
  });

  it('matches the numbers quoted in the "no reliable boundary" explanation', () => {
    const e = boundaryEvidence(ds.tests);
    expect(e).toMatchObject({ usable: 101, burned: 57, noIgnition: 44, investigations: 2 });
    expect(e.flex.burned).toBe(e.flex.total);
    expect(e.flex.below25 / e.flex.total).toBeGreaterThan(0.5);
    expect(e.cfiG).toEqual({ below25: 23, below25NoIgnition: 23, above35Burned: 28, above35NoIgnition: 21 });
  });

  it('real-data model is not meaningful, so no boundary is drawn', () => {
    const m = fitLogistic(ds.tests);
    expect(m === null || !boundaryIsMeaningful(m)).toBe(true);
  });
});
