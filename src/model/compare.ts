import type { Investigation, Range, Sourced } from '../data/schema';
import { fmtRange as fmtR } from '../lib/format';

export type Diff = { same: string[]; different: { field: string; a: string; b: string }[] };

const NOT_REPORTED = 'not reported';

function fmtRange(s: Sourced<Range>, unit: string): string {
  if (s.confidence === 'missing' || s.value === null) return NOT_REPORTED;
  return fmtR(s.value, unit);
}

function fmtList(items: string[]): string {
  return items.length === 0 ? 'none listed' : items.join(', ');
}

const setKey = (items: string[]) => [...new Set(items)].sort().join('\u0000');
const sortedList = (items: string[]) => [...new Set(items)].sort((x, y) => x.localeCompare(y));

type Row = { field: string; a: string; b: string; keyA: string; keyB: string };

export function diffInvestigations(a: Investigation, b: Investigation): Diff {
  const rows: Row[] = [
    { field: 'hardware', a: a.hardware, b: b.hardware, keyA: a.hardware, keyB: b.hardware },
    { field: 'platform', a: a.platform, b: b.platform, keyA: a.platform, keyB: b.platform },
    { field: 'fuelPhase', a: a.fuelPhase, b: b.fuelPhase, keyA: a.fuelPhase, keyB: b.fuelPhase },
    ...(
      [
        ['fuels', a.fuels, b.fuels],
        ['sensors', a.sensors, b.sensors],
        ['pillars', a.pillars as string[], b.pillars as string[]],
      ] as [string, string[], string[]][]
    ).map(([field, x, y]) => ({
      field, a: fmtList(sortedList(x)), b: fmtList(sortedList(y)), keyA: setKey(x), keyB: setKey(y),
    })),
  ];
  const ranges: [string, Sourced<Range>, Sourced<Range>, string][] = [
    ['o2Percent', a.o2Percent, b.o2Percent, '% O₂'],
    ['pressurePsi', a.pressurePsi, b.pressurePsi, ' psi'],
    ['flowCmS', a.flowCmS, b.flowCmS, ' cm/s'],
  ];
  for (const [field, x, y, unit] of ranges) {
    const fa = fmtRange(x, unit);
    const fb = fmtRange(y, unit);
    rows.push({ field, a: fa, b: fb, keyA: fa, keyB: fb });
  }
  // keep the field order of the brief
  const order = ['hardware', 'platform', 'fuelPhase', 'fuels', 'o2Percent', 'pressurePsi', 'flowCmS', 'sensors', 'pillars'];
  rows.sort((p, q) => order.indexOf(p.field) - order.indexOf(q.field));

  const same: string[] = [];
  const different: Diff['different'] = [];
  for (const r of rows) {
    if (r.keyA === r.keyB) {
      same.push(r.a === NOT_REPORTED ? `Neither reports ${r.field}` : `${r.field}: ${r.a}`);
    } else {
      different.push({ field: r.field, a: r.a, b: r.b });
    }
  }
  return { same, different };
}
