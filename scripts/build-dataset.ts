/**
 * Builds src/data/investigations.json from the NASA PSI downloads in data-raw/psi
 * plus the hand-curated text in scripts/curated/investigations.curated.json.
 *
 * Run: npx tsx scripts/build-dataset.ts
 *
 * The CSV files are treated as data only. Mapping rules are documented in
 * docs/data-sources.md; keep the two in sync.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDataset } from '../src/data/loadData';
import type { Dataset, Investigation, Range, Sourced, TestPoint } from '../src/data/schema';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = resolve(ROOT, 'data-raw/psi');
const CURATED = resolve(ROOT, 'scripts/curated/investigations.curated.json');
const OUT = resolve(ROOT, 'src/data/investigations.json');

export const ATM_TO_PSI = 14.696;
export const BAR_TO_PSI = 14.504;
export const MMHG_TO_PSI = 0.019337;

const GUIDE_URL =
  'https://www.nasa.gov/sites/default/files/atoms/files/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf';

export const psiUrl = (n: number) => `https://psi.nasa.gov/physci/repo/data/investigations/PSI-${n}`;

// ---------------------------------------------------------------- CSV helpers

function decode(buf: Buffer): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buf);
  } catch {
    // A few PSI tables were exported as Windows-1252 (e.g. en dashes in FLEX).
    text = new TextDecoder('windows-1252').decode(buf);
  }
  return text.replace(/^﻿/, '');
}

/** Minimal RFC 4180 parser (quoted fields, doubled quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

type Table = { file: string; header: string[]; rows: string[][] };

function readTable(file: string): Table {
  const all = parseCsv(decode(readFileSync(resolve(RAW, file))));
  const [header, ...rows] = all;
  return { file, header, rows };
}

/** Strict number: the whole trimmed cell must be a number. */
export function num(cell: string | undefined): number | null {
  if (cell === undefined) return null;
  const s = cell.trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  return Number(s);
}

/** "~ 21.5" -> 21.5, "21.5 - 21.7" / "22.1 to 22.0" -> midpoint. */
export function approx(cell: string | undefined): number | null {
  if (cell === undefined) return null;
  const s = cell.replace(/~/g, '').trim();
  const parts = s.split(/\s+-\s+|\s+to\s+/i);
  const vals = parts.map((p) => num(p));
  if (vals.length === 0 || vals.some((v) => v === null)) return null;
  return (vals as number[]).reduce((a, b) => a + b, 0) / vals.length;
}

/** "20 cm/s" -> 20; anything not stated in cm/s -> null. */
function cmPerS(cell: string | undefined): number | null {
  const m = cell?.trim().match(/^(\d+\.?\d*)\s*cm\/s$/i);
  return m ? Number(m[1]) : null;
}

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------- test points

type Measured = NonNullable<TestPoint['measured']>;

function point(
  investigationId: string,
  psi: number,
  t: Table,
  rowIndex: number, // 0-based index into t.rows
  o2Percent: number,
  pressurePsi: number | null,
  flowCmS: number | null,
  fuel: string,
  outcome: TestPoint['outcome'],
  measured?: Measured,
): TestPoint {
  const p: TestPoint = {
    investigationId,
    o2Percent: r4(o2Percent),
    pressurePsi: pressurePsi === null ? null : r4(pressurePsi),
    flowCmS: flowCmS === null ? null : r4(flowCmS),
    fuel,
    outcome,
    source: `PSI-${psi} Experimental table ${t.file}, row ${rowIndex + 1}`,
  };
  if (measured) p.measured = measured;
  return p;
}

type ExtraRange = { field: 'flowCmS' | 'pressurePsi' | 'o2Percent'; values: number[]; files: string[] };
type Parsed = { tests: TestPoint[]; extra: ExtraRange[] };

/** BASS-II: initial O2 from the table; outcome from crew notes in the fan/air display cells. */
function parseBassII(): Parsed {
  const t = readTable('PSI-25_Experimental table_BASS-II.csv');
  const tests: TestPoint[] = [];
  t.rows.forEach((r, i) => {
    const o2 = num(r[11]);
    if (o2 === null) return;
    const notes = `${r[7] ?? ''} ${r[8] ?? ''}`.toLowerCase();
    const fuel = clean(r[5]);
    const co2 = num(r[14]);
    if (/no ign/.test(notes)) tests.push(point('bass-ii', 25, t, i, o2, null, null, fuel, 'no_ignition'));
    else if (/ext|blowoff|\bout\b|would not stay lit/.test(notes))
      tests.push(point('bass-ii', 25, t, i, o2, null, null, fuel, 'extinguished'));
    else if (/\bign/.test(notes)) tests.push(point('bass-ii', 25, t, i, o2, null, null, fuel, 'burned'));
    else
      tests.push(
        point('bass-ii', 25, t, i, o2, null, null, fuel, 'measured',
          co2 === null ? undefined : { name: 'Final CO2 in working volume', value: co2, unit: '% vol' }),
      );
  });
  return { tests, extra: [] };
}

function parseSaffireI(): Parsed {
  const t = readTable('PSI-98_Experimental table_SAFFIRE-1.csv');
  const tests: TestPoint[] = [];
  t.rows.forEach((r, i) => {
    const o2 = approx(r[6]);
    if (o2 === null || !r[1]?.trim()) return;
    const burn = num(r[9]);
    tests.push(
      burn !== null && burn > 0
        ? point('saffire-i', 98, t, i, o2, null, num(r[5]), clean(r[1]), 'burned', { name: 'Burn time', value: burn, unit: 's' })
        : point('saffire-i', 98, t, i, o2, null, num(r[5]), clean(r[1]), 'measured'),
    );
  });
  return { tests, extra: [] };
}

function parseSaffireII(): Parsed {
  const t = readTable('PSI-99_Experimental table_SAFFIRE-2.csv');
  const tests: TestPoint[] = [];
  let material = '';
  t.rows.forEach((r, i) => {
    if (!/^2-\d+$/.test(r[0]?.trim() ?? '')) return;
    // Blank Material cells continue the material above (merged cells in the source sheet).
    if (r[1]?.trim()) material = clean(r[1]);
    const o2 = approx(r[6]);
    if (o2 === null) return;
    const flow = cmPerS(r[5]);
    const ugLength = r[11]?.trim() ?? '';
    if (material.includes('&')) {
      // Row 2-7 "PMMA & Nomex": Note 2 says the PMMA was completely consumed but the Nomex was not ignited.
      const pmmaLen = approx(ugLength.split('&')[0].replace(/cm/i, ''));
      tests.push(point('saffire-ii', 99, t, i, o2, null, flow, 'PMMA (PMMA & Nomex sample)', 'burned',
        pmmaLen === null ? undefined : { name: 'Microgravity burn length', value: pmmaLen, unit: 'cm' }));
      tests.push(point('saffire-ii', 99, t, i, o2, null, flow, 'Nomex (PMMA & Nomex sample)', 'no_ignition'));
      return;
    }
    const len = approx(ugLength.replace(/\(.*\)/, '').replace(/cm/i, ''));
    const spread = r[12]?.trim().match(/^(\d+\.?\d*)\s*mm\/s$/);
    if (len !== null && len > 0) {
      tests.push(point('saffire-ii', 99, t, i, o2, null, flow, material, 'burned',
        spread ? { name: 'Microgravity flame spread rate', value: Number(spread[1]), unit: 'mm/s' }
          : { name: 'Microgravity burn length', value: len, unit: 'cm' }));
    } else if (len !== null) {
      tests.push(point('saffire-ii', 99, t, i, o2, null, flow, material, 'measured',
        { name: 'Microgravity burn length', value: len, unit: 'cm' }));
    }
  });
  return { tests, extra: [] };
}

function parseSaffireIII(): Parsed {
  const t = readTable('PSI-100_Experimental table_SAFFIRE-3.csv');
  const flows = t.rows.map((r) => cmPerS(r[5])).filter((v): v is number => v !== null);
  return { tests: [], extra: [{ field: 'flowCmS', values: flows, files: [t.file] }] };
}

function parseFlex(): Parsed {
  const t = readTable('PSI-69_Experimental table_FLEX.csv');
  const tests: TestPoint[] = [];
  t.rows.forEach((r, i) => {
    const x = num(r[6]);
    if (x === null) return;
    const mmHg = num(r[5]);
    const p = mmHg !== null && mmHg > 0 ? mmHg * MMHG_TO_PSI : null;
    const co2 = num(r[8]) ?? 0;
    const he = num(r[9]) ?? 0;
    const fuel = clean(r[4]) + (co2 > 0 ? ' (CO2-diluted)' : '') + (he > 0 ? ' (He-diluted)' : '');
    const ext = num(r[11]);
    const k = num(r[12]);
    const rate: Measured | undefined = k === null ? undefined : { name: 'Burning rate constant', value: k, unit: 'mm^2/s' };
    const end = r[14]?.trim();
    if (end === 'Extinction')
      tests.push(point('flex', 69, t, i, x * 100, p, null, fuel, 'extinguished',
        ext !== null && ext > 0 ? { name: 'Flame extinction diameter', value: ext, unit: 'mm' } : rate));
    else if (end === 'Completion') tests.push(point('flex', 69, t, i, x * 100, p, null, fuel, 'burned', rate));
    else tests.push(point('flex', 69, t, i, x * 100, p, null, fuel, 'measured', rate));
  });
  return { tests, extra: [] };
}

function parseCfi(): Parsed {
  const t = readTable('PSI-39_Experimental table_CFI.csv');
  const tests: TestPoint[] = [];
  t.rows.forEach((r, i) => {
    const x = num(r[5]);
    const m = r[4]?.trim().match(/^(\d+\.?\d*)\s*atm$/);
    if (x === null) return;
    const he = num(r[7]) ?? 0;
    const fuel = clean(r[9]) + (he > 0 ? ' (He-diluted ambient)' : '');
    tests.push(point('cfi', 39, t, i, x * 100, m ? Number(m[1]) * ATM_TO_PSI : null, null, fuel, 'measured'));
  });
  return { tests, extra: [] };
}

function cfiGOutcome(hot: string, endMode: string): TestPoint['outcome'] {
  const h = hot.trim().toLowerCase();
  if (h === 'no') return 'no_ignition';
  if (h === 'yes') return endMode.trim() === 'SE' ? 'extinguished' : 'burned';
  return 'measured'; // e.g. "flash": not a sustained ignition, not stated as failure either
}

function parseCfiG(): Parsed {
  const tests: TestPoint[] = [];
  const inv = readTable('PSI-159_Experimental table_CFI-G_Inverse Flames.csv');
  let fuel = '';
  inv.rows.forEach((r, i) => {
    if (r[2]?.trim()) fuel = clean(r[2]);
    const x = num(r[7]);
    if (x === null) return;
    const bar = num(r[6]);
    const burn = num(r[14]);
    const outcome = cfiGOutcome(r[13] ?? '', r[15] ?? '');
    tests.push(point('acme-cfi-g', 159, inv, i, x * 100, bar === null ? null : bar * BAR_TO_PSI, null,
      `${fuel} (inverse flame)`, outcome,
      outcome !== 'no_ignition' && outcome !== 'measured' && burn !== null ? { name: 'Burn time', value: burn, unit: 's' } : undefined));
  });
  const nor = readTable('PSI-159_Experimental table_CFI-G_Normal Flames.csv');
  nor.rows.forEach((r, i) => {
    const x = num(r[5]);
    if (x === null) return;
    const bar = num(r[7]);
    const burn = num(r[14]);
    const outcome = cfiGOutcome(r[13] ?? '', r[15] ?? '');
    tests.push(point('acme-cfi-g', 159, nor, i, x * 100, bar === null ? null : bar * BAR_TO_PSI, null,
      `${clean(r[2])} (normal flame)`, outcome,
      outcome !== 'no_ignition' && outcome !== 'measured' && burn !== null ? { name: 'Burn time', value: burn, unit: 's' } : undefined));
  });
  return { tests, extra: [] };
}

function parseFlameDesign(): Parsed {
  const tests: TestPoint[] = [];
  const tad = (v: number | null): Measured | undefined =>
    v === null ? undefined : { name: 'Adiabatic flame temperature (calculated, as listed)', value: v, unit: 'K' };
  const inv = readTable('PSI-10_Experimental table_Flame Design_Inverse Flame.csv');
  inv.rows.forEach((r, i) => {
    const x = num(r[3]);
    if (x === null) return;
    const atm = num(r[11]); // inverse table: pmean (atm) is column 11 (no Fuel column)
    tests.push(point('acme-flame-design', 10, inv, i, x * 100, atm === null ? null : atm * ATM_TO_PSI, null,
      'C2H4 (inverse flame)', 'measured', tad(num(r[13]))));
  });
  const nor = readTable('PSI-10_Experimental table_Flame Design_Normal Flame.csv');
  nor.rows.forEach((r, i) => {
    const x = num(r[8]);
    if (x === null) return;
    const atm = num(r[12]);
    tests.push(point('acme-flame-design', 10, nor, i, x * 100, atm === null ? null : atm * ATM_TO_PSI, null,
      `${clean(r[2])} (normal flame)`, 'measured', tad(num(r[14]))));
  });
  return { tests, extra: [] };
}

function parseBre(): Parsed {
  const t = readTable('PSI-20_Experimental table_ACME BRE.csv');
  const tests: TestPoint[] = [];
  t.rows.forEach((r, i) => {
    const ignited = num(r[6]);
    if (ignited === null || ignited <= 0) return;
    // Notes: "approximate concentrations for tests that ignited are listed".
    for (const part of (r[5] ?? '').split(';')) {
      const o2 = num(part);
      if (o2 === null) continue; // e.g. "3400%" / "2100%" are left out as unparseable
      tests.push(point('acme-bre', 20, t, i, o2, null, null, `${clean(r[4])} (${clean(r[3])} mm burner)`, 'burned'));
    }
  });
  return { tests, extra: [] };
}

function parseSFlame(): Parsed {
  const t = readTable('PSI-23_Experimental table_ACME s-Flame.csv');
  const tests: TestPoint[] = [];
  t.rows.forEach((r, i) => {
    const ignited = num(r[7]);
    if (ignited === null || ignited <= 0) return;
    for (const m of (r[5] ?? '').matchAll(/~(\d+\.?\d*)%/g)) {
      // The sheet auto-incremented "N2" down the column (N3, N4, ...); those are fill artifacts for N2.
      const fuel = clean(r[6]).replace(/\bN[3-9]\b/g, 'N2');
      tests.push(point('acme-s-flame', 23, t, i, Number(m[1]), null, null, fuel, 'burned'));
    }
  });
  return { tests, extra: [] };
}

function flowColumn(file: string, col: number): ExtraRange {
  const t = readTable(file);
  // Negative velocities (e.g. -0.28, -5.92 in SPICE) are sensor offsets, not flows: left out.
  const values = t.rows.map((r) => num(r[col])).filter((v): v is number => v !== null && v >= 0);
  return { field: 'flowCmS', values, files: [file] };
}

function parseAll(): Parsed {
  const parts: Parsed[] = [
    parseBassII(), parseSaffireI(), parseSaffireII(), parseSaffireIII(), parseFlex(), parseCfi(), parseCfiG(),
    parseFlameDesign(), parseBre(), parseSFlame(),
    { tests: [], extra: [flowColumn('PSI-107_Experimental table_Spice.csv', 8)] },
    { tests: [], extra: [flowColumn('PSI-102_Experimental table_SAME.csv', 2)] },
    { tests: [], extra: [flowColumn('PSI-101_Experimental table_SAME-R.csv', 4)] },
  ];
  return { tests: parts.flatMap((p) => p.tests), extra: parts.flatMap((p) => p.extra) };
}

// ---------------------------------------------------------------- curated merge

type CuratedSourced<T> = { value: T; source: string; confidence: 'stated' } | { value: null; source: null; confidence: 'missing' };

type Curated = {
  psi: number;
  name: string;
  years: string;
  platform: string;
  hardware: string;
  fuelPhase: Investigation['fuelPhase'];
  fuels: string[];
  sampleGeometry: CuratedSourced<string>;
  stated?: Partial<Record<'o2Percent' | 'pressurePsi' | 'flowCmS', { value: Range; source: string }>>;
  diluents: string[];
  varied: string[];
  fixed: string[];
  sensors: string[];
  findings: { text: string; source: string }[];
  pillars: Investigation['pillars'];
  summary: string;
};

/** Expands short source tags used in the curated file. */
export function expandSource(src: string, psi: number): string {
  const rec = src.match(/^record:(.+)$/);
  if (rec) return `PSI-${psi} record: ${rec[1].trim()}; ${psiUrl(psi)}`;
  const pub = src.match(/^pub:(.+)$/);
  if (pub) return `PSI-${psi} record: publications, "${pub[1].trim()}"; ${psiUrl(psi)}`;
  const guide = src.match(/^guide:p\.?\s*(\d+)$/);
  if (guide)
    return `NASA ISS Program Science Office, "A Researcher's Guide to: Combustion Science" (NP-2015-10-034-JSC), p. ${guide[1]}; ${GUIDE_URL}`;
  const row = src.match(/^row:(.+)$/);
  if (row) return `PSI-${psi} Experimental table ${row[1].trim()}`;
  return src;
}

function rangeOf(values: number[]): Range {
  return { min: r4(Math.min(...values)), max: r4(Math.max(...values)) };
}

function sourcedRange(
  id: string,
  c: Curated,
  field: 'o2Percent' | 'pressurePsi' | 'flowCmS',
  tests: TestPoint[],
  extra: ExtraRange[],
): Sourced<Range> {
  const fromTests = tests.filter((t) => t.investigationId === id && t[field] !== null);
  if (fromTests.length) {
    const files = [...new Set(fromTests.map((t) => t.source.replace(/^PSI-\d+ Experimental table (.+), row \d+$/, '$1')))];
    return {
      value: rangeOf(fromTests.map((t) => t[field] as number)),
      source: `Derived from ${fromTests.length} test rows in PSI-${c.psi} Experimental table ${files.join('; ')}; ${psiUrl(c.psi)}`,
      confidence: 'derived',
    };
  }
  const ex = extra.find((e) => e.field === field && e.files[0].startsWith(`PSI-${c.psi}_`));
  if (ex && ex.values.length) {
    return {
      value: rangeOf(ex.values),
      source: `Derived from ${ex.values.length} rows in PSI-${c.psi} Experimental table ${ex.files.join('; ')}; ${psiUrl(c.psi)}`,
      confidence: 'derived',
    };
  }
  const st = c.stated?.[field];
  if (st) return { value: st.value, source: expandSource(st.source, c.psi), confidence: 'stated' };
  return { value: null, source: null, confidence: 'missing' };
}

export function buildDataset(): Omit<Dataset, 'generatedAt'> {
  const curated = JSON.parse(readFileSync(CURATED, 'utf8')) as Record<string, Curated | string>;
  const { tests, extra } = parseAll();
  const investigations: Investigation[] = Object.entries(curated)
    .filter((e): e is [string, Curated] => typeof e[1] === 'object')
    .map(([id, c]) => {
      return {
        id,
        name: c.name,
        years: c.years,
        platform: c.platform,
        hardware: c.hardware,
        fuelPhase: c.fuelPhase,
        fuels: c.fuels,
        sampleGeometry:
          c.sampleGeometry.confidence === 'missing'
            ? c.sampleGeometry
            : { ...c.sampleGeometry, source: expandSource(c.sampleGeometry.source, c.psi) },
        o2Percent: sourcedRange(id, c, 'o2Percent', tests, extra),
        pressurePsi: sourcedRange(id, c, 'pressurePsi', tests, extra),
        flowCmS: sourcedRange(id, c, 'flowCmS', tests, extra),
        diluents: c.diluents,
        varied: c.varied,
        fixed: c.fixed,
        sensors: c.sensors,
        findings: c.findings.map((f) => ({ text: f.text, source: expandSource(f.source, c.psi) })),
        pillars: c.pillars,
        psiUrl: psiUrl(c.psi),
        summary: c.summary,
      };
    });
  return { investigations, tests };
}

function main() {
  const built = buildDataset();
  const dataset: Dataset = { ...built, generatedAt: new Date().toISOString() };
  loadDataset(dataset); // throws with a path list if anything is invalid
  writeFileSync(OUT, JSON.stringify(dataset, null, 2) + '\n');
  const byInv = new Map<string, Record<string, number>>();
  for (const t of dataset.tests) {
    const m = byInv.get(t.investigationId) ?? {};
    m[t.outcome] = (m[t.outcome] ?? 0) + 1;
    byInv.set(t.investigationId, m);
  }
  console.log(`Wrote ${OUT}: ${dataset.investigations.length} investigations, ${dataset.tests.length} test points`);
  for (const [id, m] of byInv) console.log(`  ${id}: ${JSON.stringify(m)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
