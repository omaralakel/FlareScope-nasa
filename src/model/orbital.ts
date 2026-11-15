import type { Dataset, Investigation } from '../data/schema';

/** Platforms flown in orbit (ISS, or a cargo vehicle in orbit such as Cygnus), i.e. microgravity. */
const ORBITAL_RE = /International Space Station|\bISS\b|Cygnus|orbit/i;

export const isOrbital = (inv: Pick<Investigation, 'platform'>) => ORBITAL_RE.test(inv.platform);

/** Splits dataset test points by whether their investigation's platform is orbital. */
export function countOrbitalTests(dataset: Pick<Dataset, 'investigations' | 'tests'>) {
  const orbitalIds = new Set(dataset.investigations.filter(isOrbital).map((i) => i.id));
  const excluded = dataset.tests.filter((t) => !orbitalIds.has(t.investigationId));
  return {
    orbital: dataset.tests.length - excluded.length,
    excluded: excluded.length,
    excludedInvestigations: [...new Set(excluded.map((t) => t.investigationId))],
  };
}
