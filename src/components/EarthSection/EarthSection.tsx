import { dataset } from '../../data/dataset';
import { shortName } from '../../data/names';
import { SAME_DAFT, SPINOFFS, type Spinoff } from '../../data/spinoffs';
import './earthSection.css';

type Props = { onSelectInvestigation?: (id: string) => void };

const NAMES = new Map(dataset.investigations.map((i) => [i.id, shortName(i)]));

function Card({ item, onSelectInvestigation, wide }: { item: Spinoff; onSelectInvestigation?: (id: string) => void; wide?: boolean }) {
  return (
    <article className={`es-card${wide ? ' es-card--wide' : ''}`} aria-labelledby={`es-${item.id}`}>
      {item.year && <p className="es-card__year">{item.year}</p>}
      <h3 className="es-card__title" id={`es-${item.id}`}>{item.title}</h3>
      <p className="es-card__summary">{item.summary}</p>
      <div className="es-card__links">
        <p className="es-card__label">In the PSI data</p>
        {item.links.length ? (
          <ul className="es-chips">
            {item.links.map((l) => (
              <li key={l.id}>
                <button type="button" className="es-chip" title={l.why} onClick={() => onSelectInvestigation?.(l.id)}>
                  {NAMES.get(l.id) ?? l.id}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="es-card__none">No direct match in the PSI combustion data.</p>
        )}
      </div>
      <a className="es-card__source" href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
        Source: {item.sourceLabel}
      </a>
    </article>
  );
}

export function EarthSection({ onSelectInvestigation }: Props) {
  return (
    <section className="es" aria-labelledby="es-title">
      <p className="es__kicker">Back on Earth</p>
      <h2 className="es__title" id="es-title">Fire safety built for space, now on the ground</h2>
      <div className="es-grid">
        {SPINOFFS.map((s) => <Card key={s.id} item={s} onSelectInvestigation={onSelectInvestigation} />)}
        <Card item={SAME_DAFT} onSelectInvestigation={onSelectInvestigation} wide />
      </div>
    </section>
  );
}
