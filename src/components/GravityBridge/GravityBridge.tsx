import type { CSSProperties } from 'react';
import type { Dataset } from '../../data/schema';
import { shortName } from '../../data/names';
import {
  GRAVITY_PAIRS, isNoBurn, orbitPassEarthFail, SAFFIRE_II_ID, type GravityPair,
} from '../../data/gravityPairs';
import { GRAVITY_PRESETS, HABITATS } from '../../model/habitats';
import { countOrbitalTests } from '../../model/orbital';
import { useStore } from '../../state/store';
import { SourceTip } from '../Source/SourceTip';
import './gravityBridge.css';

type Props = { dataset: Dataset; onSelectInvestigation?: (id: string) => void };

const BRIEF_LABEL = 'NASA Space Apps 2026 challenge brief: Flame in Freefall';
const BRIEF_URL = 'https://www.spaceappschallenge.org/';
/** Local reference copy of the brief, committed in the repo. */
const BRIEF_DOC = 'docs/challenge-brief.md, Partial-gravity data';

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
    text: 'Partial gravity was mimicked through the effect of an electric field on the ions that naturally occur in flames.',
    investigationId: 'acme-e-field',
  },
  {
    id: 'luci',
    kicker: 'Planned',
    title: 'LUCI: Lunar-g Combustion Investigation',
    text: 'Partial-gravity combustion data is expected to be added to PSI in the future, for example from LUCI.',
  },
  {
    id: 'fm2',
    kicker: 'Planned',
    title: 'FM2: Flammability of Materials on the Moon',
    text: 'Partial-gravity combustion data is expected to be added to PSI in the future, for example from FM2.',
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
  const tests = countOrbitalTests(dataset);
  const names = new Map(dataset.investigations.map((i) => [i.id, shortName(i)]));
  const isHabitat = (g: number) => h.gravityG === g;
  const pos = (g: number) => ({ '--x': `${g * 100}%` }) as CSSProperties;

  return (
    <section className="gb" aria-labelledby="gb-title">
      <p className="gb__kicker">Gravity bridge · SAFFIRE-II paired burns</p>
      <h2 className="gb__title" id="gb-title">What didn't burn in orbit burned at 1 g</h2>
      <p className="gb__sub">The Moon (0.166 g) and Mars (0.38 g) sit in between — and are untested in PSI.</p>
      <p className="gb__lede">
        In SAFFIRE-II, {flips.length} of {silicone.length} silicone samples had a burn length of
        about 0 in microgravity, yet burned completely in 1 g (samples {flips.map((p) => p.id).join(' and ')}).
        Same flow of about 20 cm/s, about 21.5 to 22.1% O₂. Moon and Mars gravity lie between 0 and 1 g,
        and no PSI result exists there.
      </p>
      <p className="gb__context">
        <span><strong>{tests.orbital}</strong> test points from orbital (microgravity) investigations</span>
        {tests.excluded > 0 && (
          <span><strong>{tests.excluded}</strong> from non-orbital platforms, not counted</span>
        )}
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
          <span role="columnheader" className={`gb-cell gb-end gb-end--right${isHabitat(1) ? ' is-habitat' : ''}`}>
            Earth, 1 g
          </span>
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
                <span className="gb-cell gb-gap" role="cell" aria-hidden="true" />
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
          <span><span className="gb-swatch" aria-hidden="true" /> ~0 in orbit, complete at 1 g</span>
          <span className="gb-legend__hab">Your habitat: {h.label}, {h.gravityG} g</span>
        </p>
        <p className="gb-source">
          Values copied as written in PSI-99 Experimental table (SAFFIRE-2.csv). Samples were 29 cm long, except
          2-7 (5 and 24 cm). Hover or
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
            <p className="gb-card__source">
              Source:{' '}
              <a href={BRIEF_URL} target="_blank" rel="noopener noreferrer">
                {BRIEF_LABEL}<span className="sr-only"> (opens in new tab)</span>
              </a>
              <span className="gb-card__doc">{BRIEF_DOC}</span>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
