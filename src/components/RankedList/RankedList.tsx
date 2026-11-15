import { useMemo, useState } from 'react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import type { Dataset } from '../../data/schema';
import insightsJson from '../../data/insights.json';
import { whyLine, type Insights } from '../../model/insights';
import { HABITATS } from '../../model/habitats';
import { DEFAULT_WEIGHTS, normalizeWeights, rankInvestigations, type Weights } from '../../model/rank';
import { useStore } from '../../state/store';
import './rankedList.css';

const INSIGHTS = insightsJson as Insights;

type Props = { dataset: Dataset; onSelectInvestigation?: (id: string) => void };

const FACTORS = [
  { key: 'condition', factor: 'conditionMatch', label: 'Conditions', cls: 'rl-seg--c' },
  { key: 'pillar', factor: 'pillarMatch', label: 'Safety pillars', cls: 'rl-seg--p' },
  { key: 'material', factor: 'materialMatch', label: 'Material', cls: 'rl-seg--m' },
] as const;

export function RankedList({ dataset, onSelectInvestigation }: Props) {
  const { habitat } = useStore();
  const h = HABITATS[habitat];
  const reduce = useReducedMotion();
  const [raw, setRaw] = useState<Weights>(DEFAULT_WEIGHTS);
  const w = useMemo(() => normalizeWeights(raw), [raw]);
  const rows = useMemo(() => rankInvestigations(dataset.investigations, h, w), [dataset, h, w]);

  return (
    <section className="rl" aria-label={`Investigations ranked for ${h.label}`}>
      <h2 className="rl__title">Ranked for {h.label}</h2>
      <details className="rl-how">
        <summary>How is this ranked?</summary>
        <p className="rl-how__text">
          Score = conditions match + safety pillars covered + material relevance, each weighted. Weights are rescaled to sum to 1.
        </p>
        {FACTORS.map((f) => (
          <label key={f.key} className="rl-how__row">
            <span className={`rl-dot ${f.cls}`} aria-hidden="true" />
            <span className="rl-how__name">{f.label}</span>
            <input
              type="range" min={0} max={1} step={0.05} value={raw[f.key]}
              onChange={(e) => setRaw({ ...raw, [f.key]: Number(e.currentTarget.value) })}
            />
            <output>{Math.round(w[f.key] * 100)}%</output>
          </label>
        ))}
        <button type="button" className="rl-how__reset" onClick={() => setRaw(DEFAULT_WEIGHTS)}>Reset</button>
      </details>
      <div className="rl__legend" aria-hidden="true">
        {FACTORS.map((f) => (
          <span key={f.key}><span className={`rl-dot ${f.cls}`} /> {f.label}</span>
        ))}
      </div>
      <LayoutGroup>
        <ol className="rl__list">
          {rows.map((r, i) => {
            const why = whyLine(INSIGHTS, r, h);
            const parts = FACTORS.map((f) => ({ ...f, v: w[f.key] * r.factors[f.factor] }));
            const tip = parts.map((p) => `${p.label}: ${(p.v * 100).toFixed(0)}`).join(', ');
            return (
              <motion.li
                key={r.inv.id}
                layout={!reduce}
                transition={{ type: 'spring', stiffness: 420, damping: 38 }}
                className="rl-row"
              >
                <div className="rl-row__main">
                  <span className="rl-row__rank">{i + 1}</span>
                  <div className="rl-row__body">
                    <div className="rl-row__head">
                      <button type="button" className="rl-row__name" onClick={() => onSelectInvestigation?.(r.inv.id)}>
                        {r.inv.name}
                      </button>
                      <span className="rl-chip">{r.inv.fuelPhase}</span>
                      {r.inv.pillars.length > 0 && (
                        <span className="rl-tags">
                          {r.inv.pillars.map((p) => <span key={p} className="rl-tag">{p}</span>)}
                        </span>
                      )}
                    </div>
                    <div className="rl-bar" title={tip} role="img" aria-label={`Score ${(r.total * 100).toFixed(0)} of 100. ${tip}`}>
                      {parts.map((p) => (
                        <span key={p.key} className={`rl-seg ${p.cls}`} style={{ width: `${p.v * 100}%` }} />
                      ))}
                    </div>
                    <p className="rl-row__why">{why}</p>
                  </div>
                  <span className="rl-row__score">{(r.total * 100).toFixed(0)}</span>
                  {r.inv.psiUrl && (
                    <a
                      className="rl-row__link" href={r.inv.psiUrl} target="_blank" rel="noopener noreferrer"
                    >
                      PSI page<span className="sr-only"> (opens in new tab)</span> ↗
                    </a>
                  )}
                </div>
              </motion.li>
            );
          })}
        </ol>
      </LayoutGroup>
    </section>
  );
}
