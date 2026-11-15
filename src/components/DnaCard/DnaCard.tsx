import type { Investigation, Range, Sourced } from '../../data/schema';
import { HABITATS } from '../../model/habitats';
import { SourceTip } from '../Source/SourceTip';
import './dnaCard.css';

const PHASES = { solid: 'Solid', liquid: 'Liquid', gas: 'Gas', aerosol: 'Aerosol' } as const;

export function PhaseGlyph({ phase }: { phase: Investigation['fuelPhase'] }) {
  return (
    <svg className="dna-glyph" viewBox="0 0 32 32" width="32" height="32" role="img" aria-label={`${PHASES[phase]} fuel`}>
      {phase === 'solid' && <rect x="6" y="6" width="20" height="20" rx="2" fill="none" stroke="currentColor" strokeWidth="2.5" />}
      {phase === 'liquid' && (
        <path d="M16 4 C16 4 6 16 6 21 a10 10 0 0 0 20 0 C26 16 16 4 16 4Z" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
      )}
      {phase === 'gas' && (
        <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M4 10 q6 -6 12 0 t12 0" />
          <path d="M4 18 q6 -6 12 0 t12 0" />
          <path d="M4 26 q6 -6 12 0 t12 0" />
        </g>
      )}
      {phase === 'aerosol' && (
        <g fill="currentColor">
          {[[8, 8, 2.6], [20, 7, 1.8], [14, 15, 3], [25, 16, 2.2], [7, 22, 2], [18, 25, 2.8], [27, 26, 1.6]].map(([x, y, r], i) => (
            <circle key={i} cx={x} cy={y} r={r} />
          ))}
        </g>
      )}
    </svg>
  );
}

type Marker = { label: string; at: number };

type BarProps = {
  label: string;
  unit: string;
  data: Sourced<Range>;
  max: number;
  markers: Marker[];
  colorVar: string;
};

function RangeBar({ label, unit, data, max, markers, colorVar }: BarProps) {
  const r = data.confidence === 'missing' ? null : data.value;
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / max) * 100))}%`;
  const text = r ? (r.min === r.max ? `${r.min}${unit}` : `${r.min}–${r.max}${unit}`) : 'not reported';
  return (
    <div className="dna-row">
      <div className="dna-row__head">
        <span className="dna-row__label">{label}</span>
        {r ? (
          <SourceTip source={data.source} confidence={data.confidence} title={`${label}: ${text}`}>
            <span className="dna-row__val">{text}</span>
          </SourceTip>
        ) : (
          <span className="dna-row__val dna-row__val--none">not reported</span>
        )}
      </div>
      <div className={`dna-track${r ? '' : ' dna-track--none'}`} role="img" aria-label={`${label} ${text} on a 0 to ${max}${unit} scale`}>
        {r && (
          <span
            className="dna-fill"
            style={{ left: pct(r.min), width: `max(4px, calc(${pct(r.max)} - ${pct(r.min)}))`, background: `var(${colorVar})` }}
          />
        )}
        {markers.map((m) => (
          <span key={m.label} className="dna-tick" style={{ left: pct(m.at) }} title={`${m.label}: ${m.at}${unit}`} />
        ))}
      </div>
      <div className="dna-scale" aria-hidden="true">
        <span>0</span>
        <span>{max}{unit}</span>
      </div>
    </div>
  );
}

const H = HABITATS;
const O2_MARKS: Marker[] = [
  { label: 'ISS', at: H.iss.o2Percent },
  { label: 'Moon', at: H.moon.o2Percent },
  { label: 'Suit', at: H.suit.o2Percent },
];
const PSI_MARKS: Marker[] = [
  { label: 'ISS', at: H.iss.pressurePsi },
  { label: 'Moon', at: H.moon.pressurePsi },
  { label: 'Suit', at: H.suit.pressurePsi },
];

function Section({ title, items, chips }: { title: string; items: string[]; chips?: boolean }) {
  return (
    <div className="dna__sec">
      <h4>{title}</h4>
      {items.length === 0 ? (
        <p className="dna__none">none listed</p>
      ) : chips ? (
        <div className="dna__chips">{items.map((s) => <span key={s} className="dna__chip">{s}</span>)}</div>
      ) : (
        <ul className="dna__list">{items.map((s) => <li key={s}>{s}</li>)}</ul>
      )}
    </div>
  );
}

export function DnaCard({ inv }: { inv: Investigation }) {
  return (
    <article className="dna" aria-label={`${inv.name} DNA card`}>
      <header className="dna__head">
        <span className="dna__phase"><PhaseGlyph phase={inv.fuelPhase} /><span>{PHASES[inv.fuelPhase]}</span></span>
        <div>
          <h3 className="dna__name">{inv.name}</h3>
          <div className="dna__meta">{inv.years} · {inv.platform}</div>
        </div>
      </header>
      <div className="dna__badge">{inv.hardware}</div>
      <RangeBar label="O₂" unit="%" data={inv.o2Percent} max={100} markers={O2_MARKS} colorVar="--flame-orange" />
      <RangeBar label="Pressure" unit=" psi" data={inv.pressurePsi} max={76} markers={PSI_MARKS} colorVar="--flame-blue" />
      <RangeBar label="Flow" unit=" cm/s" data={inv.flowCmS} max={90} markers={[]} colorVar="--flame-core" />
      <p className="dna__legend">Ticks on O₂ and pressure: ISS, Moon base, spacesuit.</p>
      <Section title="Sensors" items={inv.sensors} chips />
      <Section title="Varied" items={inv.varied} />
      <Section title="Held fixed" items={inv.fixed} />
      <div className="dna__sec">
        <h4>Findings</h4>
        {inv.findings.length === 0 ? (
          <p className="dna__none">none listed</p>
        ) : (
          <ul className="dna__list">
            {inv.findings.map((f, i) => (
              <li key={i}>
                <SourceTip source={f.source} confidence="stated" title="Finding">
                  <span className="dna__finding">{f.text}</span>
                </SourceTip>
              </li>
            ))}
          </ul>
        )}
      </div>
      {inv.psiUrl && (
        <a className="dna__link" href={inv.psiUrl} target="_blank" rel="noreferrer">Open on NASA PSI (new tab)</a>
      )}
    </article>
  );
}

export default DnaCard;
