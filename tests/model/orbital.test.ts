import { describe, expect, it } from 'vitest';
import { dataset } from '../../src/data/dataset';
import { countOrbitalTests, isOrbital } from '../../src/model/orbital';

describe('orbital test count', () => {
  it('treats ISS and Cygnus platforms as orbital, others not', () => {
    expect(isOrbital({ platform: 'International Space Station (ISS)' })).toBe(true);
    expect(isOrbital({ platform: 'Cygnus cargo vehicle (after leaving the ISS)' })).toBe(true);
    expect(isOrbital({ platform: 'Drop tower' })).toBe(false);
  });

  it('excludes tests from non-orbital investigations', () => {
    const inv = (id: string, platform: string) => ({ id, platform }) as never;
    const t = (investigationId: string) => ({ investigationId }) as never;
    const r = countOrbitalTests({
      investigations: [inv('a', 'International Space Station (ISS)'), inv('b', 'Drop tower')],
      tests: [t('a'), t('a'), t('b')],
    });
    expect(r).toEqual({ orbital: 2, excluded: 1, excludedInvestigations: ['b'] });
  });

  it('counts every current dataset test as orbital', () => {
    const r = countOrbitalTests(dataset);
    expect(r.orbital + r.excluded).toBe(dataset.tests.length);
    expect(r.excluded).toBe(0);
  });
});
