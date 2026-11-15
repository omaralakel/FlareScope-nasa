import { describe, expect, it } from 'vitest';
import raw from '../../src/data/investigations.json';
import { loadDataset } from '../../src/data/loadData';
import type { TestPoint } from '../../src/data/schema';
import { boundaryEvidence, describeBoundaryEvidence, testsNear } from '../../src/model/coverage';
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

describe('describeBoundaryEvidence', () => {
  it('follows the data rather than fixed names', () => {
    const pts = [
      pt(15, 10, { investigationId: 'a', outcome: 'no_ignition' }),
      pt(16, 10, { investigationId: 'a', outcome: 'no_ignition' }),
      pt(40, 10, { investigationId: 'b', outcome: 'burned' }),
    ];
    const e = boundaryEvidence(pts);
    expect(e.investigations.map((i) => i.id)).toEqual(['a', 'b']);
    const text = describeBoundaryEvidence(e, (id) => id.toUpperCase());
    expect(text).toContain('Of 3 usable tests, 1 burned and 2 did not ignite.');
    expect(text).toContain('A never saw ignition (2 tests: 2 below 25% O2).');
    expect(text).toContain('B only ever recorded flames (1 test: 1 above 35% O2).');
    expect(text).not.toMatch(/FLEX|CFI/);
  });

  it('handles no usable tests', () => {
    expect(describeBoundaryEvidence(boundaryEvidence([]), (id) => id)).toContain('Of 0 usable tests');
  });
});

describe('real dataset coverage'
, () => {
  const ds = loadDataset(raw);

  it('counts tests near each habitat', () => {
    const near = (id: keyof typeof HABITATS) =>
      testsNear(ds.tests, HABITATS[id].o2Percent, HABITATS[id].pressurePsi).length;
    expect(near('iss')).toBe(223);
    expect(near('moon')).toBe(8);
    expect(near('suit')).toBe(0);
  });

  it('computes the evidence behind the "no reliable boundary" explanation', () => {
    const e = boundaryEvidence(ds.tests);
    expect(e).toMatchObject({ usable: 101, burned: 57, noIgnition: 44 });
    expect(e.investigations.map((i) => i.id)).toEqual(['acme-cfi-g', 'flex']);
    const [cfiG, flex] = e.investigations;
    expect(flex).toMatchObject({ total: 27, burned: 27, noIgnition: 0 });
    expect(cfiG.bands).toEqual([
      { label: 'below 25% O2', burned: 0, noIgnition: 23 },
      { label: 'at 25 to 35% O2', burned: 2, noIgnition: 0 },
      { label: 'above 35% O2', burned: 28, noIgnition: 21 },
    ]);
    const text = describeBoundaryEvidence(e, (id) => (id === 'flex' ? 'FLEX' : 'ACME CFI-G'));
    expect(text).toContain('Of 101 usable tests, 57 burned and 44 did not ignite.');
    expect(text).toContain('none of the 23 tests below 25% O2 ignited');
    expect(text).toContain('above 35% O2 it was a mix (28 burned, 21 did not)');
    expect(text).toContain('FLEX only ever recorded flames (27 tests: 23 below 25% O2, 4 at 25 to 35% O2)');
  });

  it('real-data model is not meaningful, so no boundary is drawn', () => {
    const m = fitLogistic(ds.tests);
    expect(m === null || !boundaryIsMeaningful(m)).toBe(true);
  });
});
