import { useMemo } from 'react';
import { dataset } from '../../data/dataset';
import { diffInvestigations } from '../../model/compare';
import { useStore } from '../../state/store';
import { DnaCard } from './DnaCard';
import './dnaCard.css';

export const DEFAULT_COMPARE: [string, string] = ['flex', 'bass'];

const FIELD_LABELS: Record<string, string> = {
  hardware: 'Hardware', platform: 'Platform', fuelPhase: 'Fuel phase', fuels: 'Fuels',
  o2Percent: 'O₂', pressurePsi: 'Pressure', flowCmS: 'Flow', sensors: 'Sensors', pillars: 'Safety pillars',
};

function label(field: string) { return FIELD_LABELS[field] ?? field; }

/** "hardware: X" -> "Hardware: X"; "Neither reports flowCmS" -> "Neither reports flow". */
function sameLine(s: string) {
  const m = s.match(/^Neither reports (\w+)$/);
  if (m) return `Neither reports ${label(m[1]).toLowerCase()}`;
  const i = s.indexOf(': ');
  return i > 0 ? `${label(s.slice(0, i))}: ${s.slice(i + 2)}` : s;
}

export function Compare() {
  const { compare, setCompare } = useStore();
  const [a, b] = compare[0] === null && compare[1] === null ? DEFAULT_COMPARE : compare;
  const invs = dataset.investigations;
  const invA = invs.find((i) => i.id === a) ?? null;
  const invB = invs.find((i) => i.id === b) ?? null;
  const diff = useMemo(() => (invA && invB ? diffInvestigations(invA, invB) : null), [invA, invB]);

  const picker = (which: 0 | 1, value: string | null, text: string) => (
    <label className="cmp-pick">
      <span>{text}</span>
      <select
        value={value ?? ''}
        onChange={(e) => {
          const v = e.currentTarget.value || null;
          which === 0 ? setCompare(v, b ?? null) : setCompare(a ?? null, v);
        }}
      >
        <option value="">Choose an investigation</option>
        {invs.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
      </select>
    </label>
  );

  return (
    <section className="cmp" aria-label="Compare investigations">
      <h2 className="cmp__title">Compare two investigations</h2>
      <p className="cmp__sub">How were they the same, and how did they differ?</p>
      <div className="cmp__pickers">{picker(0, a, 'Investigation A')}{picker(1, b, 'Investigation B')}</div>
      <div className="cmp__cards">
        {invA ? <DnaCard inv={invA} /> : <div className="cmp__empty">Pick investigation A</div>}
        {invB ? <DnaCard inv={invB} /> : <div className="cmp__empty">Pick investigation B</div>}
      </div>
      {diff && (
        <div className="cmp__diff" aria-label="Same and different">
          <div className="cmp__panel cmp__panel--same">
            <h3>Same</h3>
            {diff.same.length === 0 ? <p className="dna__none">Nothing in common on these fields.</p> : (
              <ul>{diff.same.map((s) => <li key={s}>{sameLine(s)}</li>)}</ul>
            )}
          </div>
          <div className="cmp__panel cmp__panel--diff">
            <h3>Different</h3>
            {diff.different.length === 0 ? <p className="dna__none">No differences on these fields.</p> : (
              <dl>
                {diff.different.map((d) => (
                  <div key={d.field} className="cmp__d">
                    <dt>{label(d.field)}</dt>
                    <dd><span className="cmp__ab">A</span> {d.a}</dd>
                    <dd><span className="cmp__ab">B</span> {d.b}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

export default Compare;
