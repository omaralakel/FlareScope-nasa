import { describe, expect, it } from 'vitest';
import { diffInvestigations } from '../../src/model/compare';
import { dataset } from '../../src/data/dataset';
import type { Investigation } from '../../src/data/schema';

const base: Investigation = {
  id: 'x', name: 'X', years: '2020', platform: 'ISS', hardware: 'CIR', fuelPhase: 'solid',
  fuels: ['PMMA', 'cotton'],
  sampleGeometry: { value: 'slab', source: 's', confidence: 'stated' },
  o2Percent: { value: { min: 12, max: 34 }, source: 's', confidence: 'stated' },
  pressurePsi: { value: { min: 10.2, max: 44.9 }, source: 's', confidence: 'stated' },
  flowCmS: { value: null, source: null, confidence: 'missing' },
  diluents: [], varied: [], fixed: [], sensors: [], findings: [], pillars: [],
  psiUrl: null, summary: '',
};
const mk = (o: Partial<Investigation>): Investigation => ({ ...base, ...o });

describe('diffInvestigations', () => {
  it('same hardware is listed under same', () => {
    const d = diffInvestigations(base, mk({ id: 'y' }));
    expect(d.same.some((s) => s.includes('hardware'))).toBe(true);
    expect(d.different.find((x) => x.field === 'hardware')).toBeUndefined();
  });
  it('different fuelPhase listed under different with both values', () => {
    const d = diffInvestigations(base, mk({ fuelPhase: 'gas' }));
    expect(d.different).toContainEqual({ field: 'fuelPhase', a: 'solid', b: 'gas' });
  });
  it('missing values render as "not reported"', () => {
    const d = diffInvestigations(base, mk({ flowCmS: { value: { min: 0.7, max: 85 }, source: 's', confidence: 'stated' } }));
    expect(d.different).toContainEqual({ field: 'flowCmS', a: 'not reported', b: '0.7–85 cm/s' });
    const both = diffInvestigations(base, base);
    expect(both.same).toContain('Neither reports flowCmS');
  });
  it('formats ranges with units', () => {
    const d = diffInvestigations(base, mk({ o2Percent: { value: { min: 21, max: 30 }, source: 's', confidence: 'stated' } }));
    expect(d.different.find((x) => x.field === 'o2Percent')).toEqual({ field: 'o2Percent', a: '12–34% O₂', b: '21–30% O₂' });
    expect(d.same.some((s) => s.includes('10.2–44.9 psi'))).toBe(true);
  });
  it('compares arrays as sets, order-insensitive; empty is none listed', () => {
    const d = diffInvestigations(base, mk({ fuels: ['cotton', 'PMMA'] }));
    expect(d.different.find((x) => x.field === 'fuels')).toBeUndefined();
    const e = diffInvestigations(base, mk({ sensors: ['camera'] }));
    expect(e.different).toContainEqual({ field: 'sensors', a: 'none listed', b: 'camera' });
  });
  it('real data: FLEX vs BASS', () => {
    const get = (id: string) => dataset.investigations.find((i) => i.id === id)!;
    const d = diffInvestigations(get('flex'), get('bass'));
    const fields = d.different.map((x) => x.field);
    expect(fields).toContain('hardware');
    expect(fields).toContain('fuelPhase');
  });
  it('real data: FLEX pressure is projector-readable', () => {
    const flex = dataset.investigations.find((i) => i.id === 'flex')!;
    const bass = dataset.investigations.find((i) => i.id === 'bass')!;
    const d = diffInvestigations(flex, bass);
    expect(d.different).toContainEqual({ field: 'pressurePsi', a: '10.2–44.9 psi', b: 'not reported' });
  });
});
