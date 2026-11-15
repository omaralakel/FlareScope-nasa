import { describe, expect, it } from 'vitest';
import { GRAVITY_PAIRS, orbitPassEarthFail, PSI_99_URL } from '../../src/data/gravityPairs';

describe('SAFFIRE-II gravity pairs', () => {
  it('has the 9 sample rows', () => {
    expect(GRAVITY_PAIRS).toHaveLength(9);
    expect(GRAVITY_PAIRS.map((p) => p.id)).toEqual(['2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9']);
  });

  it('has unique ids', () => {
    expect(new Set(GRAVITY_PAIRS.map((p) => p.id)).size).toBe(GRAVITY_PAIRS.length);
  });

  it('sources every pair to a PSI-99 table row', () => {
    GRAVITY_PAIRS.forEach((p, i) => {
      expect(p.source).toMatch(/PSI-99/);
      expect(p.source).toMatch(new RegExp(`data row ${i + 1} \\(header excluded\\)$`));
      expect(p.psiUrl).toBe(PSI_99_URL);
    });
  });

  it('finds the silicone samples with ~0 burn in microgravity and complete burn in 1 g', () => {
    expect(orbitPassEarthFail(GRAVITY_PAIRS).map((p) => p.id)).toEqual(['2-1', '2-4']);
  });
});
