import { describe, expect, it } from 'vitest';
import raw from '../../src/data/investigations.json';
import { loadDataset } from '../../src/data/loadData';
import type { Investigation } from '../../src/data/schema';
import { HABITATS } from '../../src/model/habitats';
import { rankInvestigations, scoreInvestigation } from '../../src/model/rank';

const missing = { value: null, source: null, confidence: 'missing' as const };

function inv(id: string, extra: Partial<Investigation> = {}): Investigation {
  return {
    id,
    name: id,
    years: '',
    platform: '',
    hardware: '',
    fuelPhase: 'solid',
    fuels: [],
    sampleGeometry: missing,
    o2Percent: missing,
    pressurePsi: missing,
    flowCmS: missing,
    diluents: [],
    varied: [],
    fixed: [],
    sensors: [],
    findings: [],
    pillars: [],
    psiUrl: null,
    summary: '',
    ...extra,
  };
}

const o2 = (min: number, max: number) => ({
  value: { min, max },
  source: 'test',
  confidence: 'stated' as const,
});

describe('habitats and ranking', () => {
  it('HABITATS.moon is 30% O2 at 10.2 psi', () => {
    expect(HABITATS.moon.o2Percent).toBe(30);
    expect(HABITATS.moon.pressurePsi).toBe(10.2);
  });

  it('an investigation whose O2 range contains 30% scores conditionMatch 1 for moon', () => {
    const s = scoreInvestigation(inv('a', { o2Percent: o2(21, 40) }), HABITATS.moon);
    expect(s.factors.conditionMatch).toBe(1);
  });

  it('an investigation with o2Percent missing gets conditionMatch 0, not NaN', () => {
    const s = scoreInvestigation(inv('a'), HABITATS.moon);
    expect(s.factors.conditionMatch).toBe(0);
    expect(Number.isNaN(s.total)).toBe(false);
  });

  it('ranking for moon puts a high-O2 solid-fuel investigation above SAME', () => {
    const solid = inv('solid', {
      fuelPhase: 'solid',
      o2Percent: o2(21, 40),
      pillars: ['prevention', 'suppression'],
    });
    const same = inv('same', { fuelPhase: 'aerosol', pillars: ['detection'] });
    const r = rankInvestigations([same, solid], HABITATS.moon);
    expect(r[0].inv.id).toBe('solid');
  });

  it('ranking is deterministic for equal scores', () => {
    const a = inv('b-name', { name: 'Bravo' });
    const b = inv('a-name', { name: 'Alpha' });
    const r1 = rankInvestigations([a, b], HABITATS.moon).map((x) => x.inv.name);
    const r2 = rankInvestigations([b, a], HABITATS.moon).map((x) => x.inv.name);
    expect(r1).toEqual(['Alpha', 'Bravo']);
    expect(r2).toEqual(r1);
  });

  it('real dataset ranks all 18 for moon with finite sorted totals', () => {
    const ds = loadDataset(raw);
    const r = rankInvestigations(ds.investigations, HABITATS.moon);
    expect(r).toHaveLength(18);
    for (const x of r) {
      expect(Number.isFinite(x.total)).toBe(true);
      expect(x.total).toBeGreaterThanOrEqual(0);
      expect(x.total).toBeLessThanOrEqual(1);
    }
    for (let i = 1; i < r.length; i++) expect(r[i - 1].total).toBeGreaterThanOrEqual(r[i].total);
  });
});
