import { describe, expect, it } from 'vitest';
import type { Investigation } from '../../src/data/schema';
import { explainRank } from '../../src/model/explain';
import { HABITATS } from '../../src/model/habitats';
import { rankInvestigations } from '../../src/model/rank';

const missing = { value: null, source: null, confidence: 'missing' as const };
const o2 = (min: number, max: number) => ({ value: { min, max }, source: 's', confidence: 'stated' as const });

function row(extra: Partial<Investigation>) {
  const inv: Investigation = {
    id: 'x', name: 'x', years: '', platform: '', hardware: '', fuelPhase: 'solid', fuels: [],
    sampleGeometry: missing, o2Percent: missing, pressurePsi: missing, flowCmS: missing,
    diluents: [], varied: [], fixed: [], sensors: [], findings: [], pillars: [], psiUrl: null, summary: '',
    ...extra,
  };
  return rankInvestigations([inv], HABITATS.moon)[0];
}

describe('explainRank', () => {
  it('in range', () => {
    expect(explainRank(row({ o2Percent: o2(21, 40), pillars: ['prevention'] }), HABITATS.moon)).toBe(
      "Tested 21–40% O₂, covers the Moon base's 30%; covers prevention; solid fuel.",
    );
  });
  it('out of range (single point, below habitat)', () => {
    expect(explainRank(row({ o2Percent: o2(21, 21) }), HABITATS.moon)).toBe(
      "Tested only near 21% O₂, 9 points below the Moon base's 30%; solid fuel.",
    );
  });
  it('out of range above habitat', () => {
    expect(explainRank(row({ o2Percent: o2(35, 50) }), HABITATS.moon)).toContain('5 points above');
  });
  it('missing O2', () => {
    expect(explainRank(row({}), HABITATS.moon)).toMatch(/^No oxygen range reported/);
  });
});

describe('explainRank pressure', () => {
  it('mentions tested pressure when reported', () => {
    const r = row({ o2Percent: o2(21, 40), pressurePsi: { value: { min: 10, max: 14.7 }, source: 's', confidence: 'stated' } });
    expect(explainRank(r, HABITATS.moon)).toContain('tested 10–14.7 psi');
  });
});

it('uses singular "point" at a gap of exactly 1', () => {
  expect(explainRank(row({ o2Percent: o2(29, 29) }), HABITATS.moon)).toContain('1 point below');
});
