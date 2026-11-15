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

/** O2 bands used to describe burn / no-burn evidence. */
export const O2_BANDS = [
  { key: 'low', label: 'below 25% O2', test: (o2: number) => o2 < 25 },
  { key: 'mid', label: 'at 25 to 35% O2', test: (o2: number) => o2 >= 25 && o2 <= 35 },
  { key: 'high', label: 'above 35% O2', test: (o2: number) => o2 > 35 },
] as const;

export type BandCount = { label: string; burned: number; noIgnition: number };

export type InvestigationEvidence = {
  id: string;
  total: number;
  burned: number;
  noIgnition: number;
  /** Only bands that contain at least one test, in O2 order. */
  bands: BandCount[];
};

export type BoundaryEvidence = {
  usable: number;
  burned: number;
  noIgnition: number;
  /** Contributing investigations, largest first. */
  investigations: InvestigationEvidence[];
};

/** Numbers behind the "No reliable flammability boundary" explanation, computed from the data. */
export function boundaryEvidence(tests: TestPoint[]): BoundaryEvidence {
  const used = boundaryTests(tests);
  const ids = [...new Set(used.map((t) => t.investigationId))];
  const investigations = ids
    .map((id): InvestigationEvidence => {
      const mine = used.filter((t) => t.investigationId === id);
      const burned = mine.filter((t) => t.outcome === 'burned').length;
      const bands = O2_BANDS.map((b) => {
        const inBand = mine.filter((t) => b.test(t.o2Percent));
        const bBurned = inBand.filter((t) => t.outcome === 'burned').length;
        return { label: b.label, burned: bBurned, noIgnition: inBand.length - bBurned };
      }).filter((b) => b.burned + b.noIgnition > 0);
      return { id, total: mine.length, burned, noIgnition: mine.length - burned, bands };
    })
    .sort((a, b) => b.total - a.total || a.id.localeCompare(b.id));
  const burned = used.filter((t) => t.outcome === 'burned').length;
  return { usable: used.length, burned, noIgnition: used.length - burned, investigations };
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

function describeBand(b: BandCount): string {
  const n = b.burned + b.noIgnition;
  if (b.noIgnition === 0) return n === 1 ? `the 1 test ${b.label} burned` : `${n === 2 ? 'both' : `all ${n}`} tests ${b.label} burned`;
  if (b.burned === 0) return n === 1 ? `the 1 test ${b.label} did not ignite` : `none of the ${n} tests ${b.label} ignited`;
  return `${b.label} it was a mix (${b.burned} burned, ${b.noIgnition} did not)`;
}

function describeInvestigation(e: InvestigationEvidence, name: string): string {
  if (e.noIgnition === 0) {
    const where = e.bands.map((b) => `${b.burned} ${b.label}`).join(', ');
    return `${name} only ever recorded flames (${plural(e.total, 'test')}: ${where})`;
  }
  if (e.burned === 0) {
    const where = e.bands.map((b) => `${b.noIgnition} ${b.label}`).join(', ');
    return `${name} never saw ignition (${plural(e.total, 'test')}: ${where})`;
  }
  const bands = e.bands.map(describeBand);
  const list = bands.length > 1 ? `${bands.slice(0, -1).join('; ')}; and ${bands[bands.length - 1]}` : bands[0];
  return `In ${name}, ${list}`;
}

/** Evidence sentences for the "Why?" panel; every number and name comes from the data. */
export function describeBoundaryEvidence(e: BoundaryEvidence, nameOf: (id: string) => string): string {
  const head =
    `The pressure-based burn / no-burn tests in the dataset do not separate by oxygen level. ` +
    `Of ${plural(e.usable, 'usable test')}, ${e.burned} burned and ${e.noIgnition} did not ignite.`;
  if (e.investigations.length === 0) return head;
  const parts = e.investigations.map((inv) => `${describeInvestigation(inv, nameOf(inv.id))}.`);
  const src =
    e.investigations.length === 1
      ? `They all come from one investigation. ${parts[0]}`
      : `They come from ${e.investigations.length} investigations. ${parts.join(' ')}`;
  return `${head} ${src}`;
}

/** The general conclusion that follows the evidence sentences. */
export const BOUNDARY_CONCLUSION =
  'Whether a flame lit depended on fuel, flow and geometry, not just O2 and pressure, so a single ' +
  'O2-versus-pressure boundary would be misleading.';
