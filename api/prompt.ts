/**
 * Grounding for the live Ask feature. The model sees a compact summary of the curated PSI
 * dataset (one block per investigation plus coverage facts), never the raw test points.
 *
 * Imports use ".js" specifiers so this file also runs as plain Node ESM once Vercel compiles
 * it; TypeScript (bundler resolution) and Vite map them back to the ".ts" sources.
 */
import type { Dataset, Investigation, Sourced, Range } from '../src/data/schema.js';
import { HABITATS } from '../src/model/habitats.js';
import { BOUNDARY_CONCLUSION, boundaryEvidence, describeBoundaryEvidence, testsNear } from '../src/model/coverage.js';
import { GRAVITY_PAIRS, isNoBurn, orbitPassEarthFail, SAFFIRE_II_ID } from '../src/data/gravityPairs.js';

const r1 = (v: number) => String(Math.round(v * 10) / 10);

function range(s: Sourced<Range>, unit: string): string {
  if (!s.value) return 'not reported';
  const { min, max } = s.value;
  const span = r1(min) === r1(max) ? `${r1(min)}${unit}` : `${r1(min)} to ${r1(max)}${unit}`;
  return `${span} (${s.confidence}; source: ${s.source})`;
}

function investigationBlock(inv: Investigation): string {
  const lines = [
    `### ${inv.id}: ${inv.name}`,
    `Fuel phase: ${inv.fuelPhase}. Fuels: ${inv.fuels.join('; ') || 'not listed'}. Hardware: ${inv.hardware}.`,
    `O2: ${range(inv.o2Percent, '%')}. Pressure: ${range(inv.pressurePsi, ' psi')}. Flow: ${range(inv.flowCmS, ' cm/s')}.`,
    `Diluents: ${inv.diluents.join(', ') || 'none listed'}. Safety pillars: ${inv.pillars.join(', ') || 'none'}.`,
    `Summary: ${inv.summary}`,
    'Findings:',
    ...inv.findings.map((f) => `- ${f.text} [source: ${f.source}]`),
    `PSI page: ${inv.psiUrl ?? 'none'}`,
  ];
  return lines.join('\n');
}

/** Compact, deterministic grounding text built only from the dataset and app constants. */
export function buildGroundingContext(dataset: Dataset): string {
  const nameOf = (id: string) => dataset.investigations.find((i) => i.id === id)?.name ?? id;

  const habitats = Object.values(HABITATS).map(
    (h) => `- ${h.label} (${h.id}): ${h.o2Percent}% O2 at ${h.pressurePsi} psi, gravity ${h.gravityG} g.${h.assumed ? ' Assumed, not specified by NASA.' : ''}`,
  );

  const near = Object.values(HABITATS).map((h) => {
    const tests = testsNear(dataset.tests, h.o2Percent, h.pressurePsi);
    const by = new Map<string, number>();
    tests.forEach((t) => by.set(t.investigationId, (by.get(t.investigationId) ?? 0) + 1));
    const list = [...by].map(([id, n]) => `${id} ${n}`).join(', ');
    return `- ${h.label}: ${tests.length} tests${list ? ` (${list})` : ''}`;
  });

  const ev = boundaryEvidence(dataset.tests);
  const noBurnOrbit = GRAVITY_PAIRS.filter((p) => isNoBurn(p.microG.burnLength));
  const flip = orbitPassEarthFail(GRAVITY_PAIRS);

  return [
    '## Habitat atmospheres used in this app',
    ...habitats,
    '',
    '## Coverage: ambient-O2 test points with known pressure near each habitat (within 3 O2 points and 1.5 psi)',
    `Total test points in the dataset: ${dataset.tests.length}.`,
    ...near,
    'All of these tests ran in microgravity on the ISS. No test in the dataset ran in lunar or Mars gravity.',
    '',
    '## Flammability boundary evidence',
    describeBoundaryEvidence(ev, nameOf),
    BOUNDARY_CONCLUSION,
    'The app therefore shows no flammability limit line for any habitat.',
    '',
    `## Gravity pairs (${SAFFIRE_II_ID}, Saffire-II, PSI-99)`,
    `${GRAVITY_PAIRS.length} samples were burned in microgravity and again in 1 g at about 20 cm/s and about 21.5 to 22.1% O2. ` +
      `${noBurnOrbit.length} showed about zero burn length in microgravity; ${flip.length} of those (${flip.map((p) => `${p.id} ${p.material}`).join(', ')}) burned completely in 1 g. ` +
      'No partial-gravity (Moon or Mars) data exists between these two points.',
    '',
    '## Investigations',
    ...dataset.investigations.map(investigationBlock),
  ].join('\n');
}

export const ANSWER_RULES = [
  'Answer only from the provided data below. Do not use outside knowledge.',
  'Cite investigation ids for each claim: every fact you state must come from an investigation listed below, and each such investigation goes in citations with its source string copied from the data.',
  'If the question is outside the data (for example rocket engines, propellants, launch vehicles, or anything not in these investigations), say it is outside the PSI data in this app and do not invent numbers.',
  'Never give a precise flammability limit the data does not contain. If asked for one, explain what the data does show.',
  'Use only the investigation ids listed below; never make up an id or a source.',
  'Keep answers short (at most 120 words) and plain, for a general audience. No markdown, no lists.',
];

/** System prompt for the live Ask: rules first, then the grounding context. */
export function buildSystemPrompt(dataset: Dataset): string {
  const ids = dataset.investigations.map((i) => i.id).join(', ');
  return [
    'You answer questions about spacecraft fire safety inside FlameScope, an app built on NASA Physical Sciences Informatics (PSI) combustion data.',
    '',
    '## Rules',
    ...ANSWER_RULES.map((r, i) => `${i + 1}. ${r}`),
    '',
    `Valid investigation ids: ${ids}.`,
    '',
    'Reply as JSON: answer (string, at most 120 words) and citations (array of { investigationId, source }).',
    '',
    '# PSI data',
    buildGroundingContext(dataset),
  ].join('\n');
}
