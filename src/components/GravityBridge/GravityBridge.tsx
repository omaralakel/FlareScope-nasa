import type { CSSProperties } from 'react';
import type { Dataset } from '../../data/schema';
import { shortName } from '../../data/names';
import {
  GRAVITY_PAIRS, isNoBurn, orbitPassEarthFail, SAFFIRE_II_ID, type GravityPair,
} from '../../data/gravityPairs';
import { GRAVITY_PRESETS, HABITATS } from '../../model/habitats';
import { useStore } from '../../state/store';
import { SourceTip } from '../Source/SourceTip';
import './gravityBridge.css';

type Props = { dataset: Dataset; onSelectInvestigation?: (id: string) => void };

const BRIEF_LABEL = 'NASA Space Apps 2026 challenge brief: Flame in Freefall';
const BRIEF_URL = 'https://www.spaceappschallenge.org/';

const MARKERS = [
  { key: 'micro', label: 'Orbit (ISS)', g: GRAVITY_PRESETS.micro },
  { key: 'moon', label: 'Moon', g: GRAVITY_PRESETS.moon },
  { key: 'mars', label: 'Mars', g: GRAVITY_PRESETS.mars },
  { key: 'earth', label: 'Earth', g: GRAVITY_PRESETS.earth },
] as const;

const CALLOUTS = [
  {
    id: 'efield',
    kicker: 'Flown on the ISS',
    title: 'E-FIELD Flames',
    text: 'Applied an electric field that acts on the ions in a flame, mimicking some partial-gravity effects without changing gravity itself.',
    investigationId: 'acme-e-field',
  },
  {
    id: 'luci',
    kicker: 'Planned',
    title: 'LUCI: Lunar-g Combustion Investigation',
    text: 'Expected to add combustion data at partial gravity in the future.',
  },
  {
    id: 'fm2',
    kicker: 'Planned',
    title: 'FM2: Flammability of Materials on the Moon',
    text: 'Expected to add material flammability data at partial gravity in the future.',
  },
] as const;

/** Groups consecutive pairs by material, keeping table order. */
function groupByMaterial(pairs: GravityPair[]) {
  const groups: { material: string; pairs: GravityPair[] }[] = [];
  for (const p of pairs) {
    const last = groups[groups.length - 1];
    if (last && last.material === p.material) last.pairs.push(p);
    else groups.push({ material: p.material, pairs: [p] });
  }
  return groups;
}

function Result({ r, side }: { r: GravityPair['microG']; side: string }) {
  const none = isNoBurn(r.burnLength);
  return (
    <div className="gb-result">
      <span className={`gb-dot${none ? ' gb-dot--none' : ''}`} aria-hidden="true" />
      <span className="gb-result__text">
        <span className="sr-only">{side}: </span>
        <span className="gb-result__len">{r.burnLength}</span>
        {r.spreadRate && <span className="gb-result__rate">spread: {r.spreadRate}</span>}
      </span>
    </div>
  );
}

export function GravityBridge({ dataset, onSelectInvestigation }: Props) {
  const { habitat } = useStore();
  const h = HABITATS[habitat];
  const groups = groupByMaterial(GRAVITY_PAIRS);
  const silicone = GRAVITY_PAIRS.filter((p) => p.material === 'Silicone');
  const flips = orbitPassEarthFail(silicone);
  const flipIds = new Set(flips.map((p) => p.id));
  const testCount = dataset.tests.length;
  const names = new Map(dataset.investigations.map((i) => [i.id, shortName(i)]));
  const isHabitat = (g: number) => h.gravityG === g;
  const pos = (g: number) => ({ '--x': `${g * 100}%` }) as CSSProperties;

  return (
    <section className="gb" aria-labelledby="gb-title">
      <p className="gb__kicker">Gravity bridge · SAFFIRE-II paired burns</p>
      <h2 className="gb__title" id="gb-title">Passing in orbit does not mean passing on the Moon</h2>
      <p className="gb__lede">
        In SAFFIRE-II, {flips.length} of {silicone.length} silicone samples had a burn length of
        about 0 in microgravity, yet burned completely in 1 g (samples {flips.map((p) => p.id).join(' and ')}).
        Same flow of about 20 cm/s, about 21.5 to 22.1% O₂. The Moon and Mars sit between these two results,
        and PSI has no test data there yet.
      </p>
      <p className="gb__context">
        <span><strong>{testCount}</strong> PSI test points in FlameScope, all in microgravity</span>
        <span><strong>0</strong> at lunar gravity</span>
        <span><strong>0</strong> at Martian gravity</span>
      </p>

      <div className="gb-chart" role="table" aria-label="Burn length in microgravity and in 1 g for the same samples">
        <div className="gb-row gb-row--head" role="row">
          <span className="gb-cell gb-cell--label" role="columnheader">Sample</span>
          <span role="columnheader" className={`gb-cell gb-end${isHabitat(0) ? ' is-habitat' : ''}`}>
            Orbit, 0 g
          </span>
          <span className="gb-cell gb-axis" role="columnheader" aria-label="Gravity between orbit and Earth">
            {MARKERS.filter((m) => m.key === 'moon' || m.key === 'mars').map((m) => (
              <span key={m.key} className={`gb-tick${isHabitat(m.g) ? ' is-habitat' : ''}`} style={pos(m.g)}>
                {m.label} <span className="gb-tick__g">{m.g} g</span>
              </span>
            ))}
          </span>
          <span role="columnheader" className="gb-cell gb-end gb-end--right">Earth, 1 g</span>
        </div>

        <div
          className="gb-band" aria-hidden="true"
          style={{ gridRow: `2 / span ${GRAVITY_PAIRS.length}` }}
        >
          {MARKERS.filter((m) => m.key === 'moon' || m.key === 'mars').map((m) => (
            <span key={m.key} className={`gb-line${isHabitat(m.g) ? ' is-habitat' : ''}`} style={pos(m.g)} />
          ))}
          <span className="gb-band__label">No partial-gravity data in PSI yet</span>
        </div>
        {groups.map((grp) => (
          <div key={grp.material} className="gb-group" role="rowgroup">
            {grp.pairs.map((p, i) => (
              <div
                key={p.id} role="row"
                className={`gb-row${flipIds.has(p.id) ? ' gb-row--flip' : ''}${i === 0 ? ' gb-row--first' : ''}`}
                style={{ '--r': GRAVITY_PAIRS.indexOf(p) + 2 } as CSSProperties}
              >
                <span className="gb-cell gb-cell--label" role="rowheader">
                  {i === 0 && <span className="gb-material">{grp.material}</span>}
                  <SourceTip
                    source={`${p.source}; ${p.psiUrl}`}
                    confidence="stated"
                    title={`Sample ${p.id}: ${p.material}`}
                    detail={
                      <>
                        Thickness {p.thickness}, {p.flowDirection.toLowerCase()} flow, O₂ {p.o2Percent}%.
                        {p.note && <><br />{p.note}</>}
                      </>
                    }
                  >
                    <span className="gb-sample">{p.id}</span>
                  </SourceTip>{' '}
                  <span className="gb-meta">{p.thickness} · {p.flowDirection}</span>
                </span>
                <span className="gb-cell gb-end" role="cell"><Result r={p.microG} side="Microgravity" /></span>
                <span className="gb-cell gb-gap" role="cell" aria-hidden="true"><span className="gb-connector" /></span>
                <span className="gb-cell gb-end gb-end--right" role="cell"><Result r={p.oneG} side="1 g" /></span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="gb-foot">
        <p className="gb-legend">
          <span><span className="gb-dot" aria-hidden="true" /> Burned: burn length above about 0</span>
          <span><span className="gb-dot gb-dot--none" aria-hidden="true" /> Burn length about 0</span>
          <span><span className="gb-swatch" aria-hidden="true" /> Orbit ~0, Earth complete</span>
          <span className="gb-legend__hab">Your habitat: {h.label}, {h.gravityG} g</span>
        </p>
        <p className="gb-source">
          Values copied as written in PSI-99 Experimental table (SAFFIRE-2.csv), all samples 29 cm long. Hover or
          focus a sample number for its row and notes.{' '}
          <button type="button" className="gb-chip" onClick={() => onSelectInvestigation?.(SAFFIRE_II_ID)}>
            Open {names.get(SAFFIRE_II_ID) ?? 'SAFFIRE-II'}
          </button>
        </p>
      </div>

      <div className="gb-callouts">
        {CALLOUTS.map((c) => (
          <article key={c.id} className="gb-card" aria-labelledby={`gb-${c.id}`}>
            <p className="gb-card__kicker">{c.kicker}</p>
            <h3 className="gb-card__title" id={`gb-${c.id}`}>{c.title}</h3>
            <p className="gb-card__text">{c.text}</p>
            {'investigationId' in c && (
              <button type="button" className="gb-chip" onClick={() => onSelectInvestigation?.(c.investigationId)}>
                {names.get(c.investigationId) ?? c.investigationId}
              </button>
            )}
            <a className="gb-card__source" href={BRIEF_URL} target="_blank" rel="noopener noreferrer">
              Source: {BRIEF_LABEL}<span className="sr-only"> (opens in new tab)</span>
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}
