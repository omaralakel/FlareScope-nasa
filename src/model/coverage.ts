import type { TestPoint } from '../data/schema';

/**
 * Ambient-O2 tests with a known pressure that lie within ±dO2 percentage points of O2 and
 * ±dP psi of the given condition (inclusive). Burner-stream tests are excluded: their O2 is
 * the oxidizer issued from a burner, not the surrounding atmosphere.
 */
export function testsNear(
  tests: TestPoint[],
  o2: number,
  pressurePsi: number,
  dO2 = 3,
  dP = 1.5,
): TestPoint[] {
  const eps = 1e-9;
  return tests.filter(
    (t) =>
      t.o2Basis === 'ambient' &&
      t.pressurePsi !== null &&
      Math.abs(t.o2Percent - o2) <= dO2 + eps &&
      Math.abs(t.pressurePsi - pressurePsi) <= dP + eps,
  );
}

/** The burn / no-burn tests a pressure-based boundary would be fit to (same filter as fitLogistic). */
export function boundaryTests(tests: TestPoint[]): TestPoint[] {
  return tests.filter(
    (t) =>
      t.o2Basis === 'ambient' &&
      t.pressurePsi !== null &&
      (t.outcome === 'burned' || t.outcome === 'no_ignition'),
  );
}

export type BoundaryEvidence = {
  usable: number;
  burned: number;
  noIgnition: number;
  investigations: number;
  flex: { total: number; burned: number; below25: number };
  cfiG: { below25: number; below25NoIgnition: number; above35Burned: number; above35NoIgnition: number };
};

/** Numbers quoted by the "No reliable flammability boundary" explanation, computed from the data. */
export function boundaryEvidence(tests: TestPoint[]): BoundaryEvidence {
  const used = boundaryTests(tests);
  const burned = used.filter((t) => t.outcome === 'burned').length;
  const flex = used.filter((t) => t.investigationId === 'flex');
  const cfiG = used.filter((t) => t.investigationId === 'acme-cfi-g');
  const below25 = cfiG.filter((t) => t.o2Percent < 25);
  const above35 = cfiG.filter((t) => t.o2Percent > 35);
  return {
    usable: used.length,
    burned,
    noIgnition: used.length - burned,
    investigations: new Set(used.map((t) => t.investigationId)).size,
    flex: {
      total: flex.length,
      burned: flex.filter((t) => t.outcome === 'burned').length,
      below25: flex.filter((t) => t.o2Percent < 25).length,
    },
    cfiG: {
      below25: below25.length,
      below25NoIgnition: below25.filter((t) => t.outcome === 'no_ignition').length,
      above35Burned: above35.filter((t) => t.outcome === 'burned').length,
      above35NoIgnition: above35.filter((t) => t.outcome === 'no_ignition').length,
    },
  };
}
