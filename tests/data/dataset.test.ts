import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadDataset } from '../../src/data/loadData';
import { buildDataset } from '../../scripts/build-dataset';

const jsonPath = fileURLToPath(new URL('../../src/data/investigations.json', import.meta.url));
const raw = JSON.parse(readFileSync(jsonPath, 'utf8'));

const REQUIRED_IDS = [
  'bass', 'bass-ii', 'saffire-i', 'saffire-ii', 'saffire-iii', 'flex', 'flex-2', 'cfi',
  'acme-cfi-g', 'acme-flame-design', 'acme-cld', 'acme-bre', 'acme-e-field', 'acme-s-flame',
  'spice', 'slice', 'same', 'same-r',
];
const SOLID_IDS = ['bass', 'bass-ii', 'saffire-i', 'saffire-ii', 'saffire-iii'];

describe('investigations.json', () => {
  const ds = loadDataset(raw);

  it('parses with loadDataset', () => {
    expect(ds.investigations.length).toBeGreaterThanOrEqual(18);
  });

  it('contains every required investigation id', () => {
    const ids = new Set(ds.investigations.map((i) => i.id));
    for (const id of REQUIRED_IDS) expect(ids, id).toContain(id);
  });

  it('has at least 6 solid-fuel TestPoints with outcome burned or no_ignition', () => {
    const solid = ds.tests.filter(
      (t) => SOLID_IDS.includes(t.investigationId) && (t.outcome === 'burned' || t.outcome === 'no_ignition'),
    );
    expect(solid.length).toBeGreaterThanOrEqual(6);
  });

  it('every investigation has a PSI url and 2-4 sourced findings', () => {
    for (const inv of ds.investigations) {
      expect(inv.psiUrl, inv.id).toMatch(/^https:\/\/psi\.nasa\.gov\/physci\/repo\/data\/investigations\/PSI-\d+$/);
      expect(inv.findings.length, inv.id).toBeGreaterThanOrEqual(2);
      expect(inv.findings.length, inv.id).toBeLessThanOrEqual(4);
      for (const f of inv.findings) expect(f.source.length, inv.id).toBeGreaterThan(0);
      expect(inv.summary.length, inv.id).toBeGreaterThan(0);
    }
  });

  it('every test point cites a PSI experimental table row', () => {
    for (const t of ds.tests) expect(t.source).toMatch(/^PSI-\d+ Experimental table .+, row \d+$/);
  });

  it('test points use only physically plausible units', () => {
    for (const t of ds.tests) {
      if (t.pressurePsi !== null) expect(t.pressurePsi).toBeGreaterThan(0);
      if (t.pressurePsi !== null) expect(t.pressurePsi).toBeLessThan(100);
      if (t.flowCmS !== null) expect(t.flowCmS).toBeGreaterThanOrEqual(0);
    }
  });

  it('matches spot-check values from the raw tables', () => {
    // FLEX table row 2: Methanol, 762 mmHg, XO2 0.21, Test end "Extinction", extinction diameter 0.94 mm
    const flex2 = ds.tests.find((t) => t.source === 'PSI-69 Experimental table PSI-69_Experimental table_FLEX.csv, row 2');
    expect(flex2).toBeDefined();
    expect(flex2!.o2Percent).toBeCloseTo(21, 6);
    expect(flex2!.pressurePsi).toBeCloseTo(762 * 0.019337, 3);
    expect(flex2!.outcome).toBe('extinguished');
    expect(flex2!.measured).toEqual({ name: 'Flame extinction diameter', value: 0.94, unit: 'mm' });
    // ACME Flame Design inverse row 1: XO2 0.37082819, pmean 1.00401873 atm
    const fd1 = ds.tests.find((t) => t.source === 'PSI-10 Experimental table PSI-10_Experimental table_Flame Design_Inverse Flame.csv, row 1');
    expect(fd1!.o2Percent).toBeCloseTo(37.0828, 3);
    expect(fd1!.pressurePsi).toBeCloseTo(1.00401873 * 14.696, 3);
    // Saffire-I row 1: SIBAL, 20 cm/s, O2 21.5-21.7 (midpoint 21.6), burned
    const s1 = ds.tests.find((t) => t.source === 'PSI-98 Experimental table PSI-98_Experimental table_SAFFIRE-1.csv, row 1');
    expect(s1).toMatchObject({ investigationId: 'saffire-i', flowCmS: 20, outcome: 'burned' });
    expect(s1!.o2Percent).toBeCloseTo(21.6, 6);
    // BASS-II row O12 ("no ign at any flow") is a no-ignition point at 13.6% O2
    const o12 = ds.tests.find((t) => t.investigationId === 'bass-ii' && t.outcome === 'no_ignition');
    expect(o12).toBeDefined();
    expect(o12!.o2Percent).toBeCloseTo(13.6, 6);
  });

  it('is reproducible from data-raw by scripts/build-dataset.ts', () => {
    const rebuilt = buildDataset();
    expect(rebuilt.tests).toEqual(raw.tests);
    expect(rebuilt.investigations).toEqual(raw.investigations);
  });
});
