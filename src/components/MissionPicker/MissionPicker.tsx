import { useRef, type KeyboardEvent } from 'react';
import { HABITATS, type HabitatId } from '../../model/habitats';
import { useStore } from '../../state/store';
import './missionPicker.css';

const ORDER = Object.keys(HABITATS) as HabitatId[];

export function MissionPicker() {
  const { habitat, setHabitat } = useStore();
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const onKeyDown = (e: KeyboardEvent) => {
    const i = ORDER.indexOf(habitat);
    let n = -1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % ORDER.length;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + ORDER.length) % ORDER.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = ORDER.length - 1;
    if (n < 0) return;
    e.preventDefault();
    setHabitat(ORDER[n]);
    refs.current[ORDER[n]]?.focus();
  };

  return (
    <section className="mp" aria-label="Mission">
      <h2 className="mp__title" id="mp-title">Pick a mission</h2>
      <div className="mp__tiles" role="radiogroup" aria-labelledby="mp-title" onKeyDown={onKeyDown}>
        {ORDER.map((id) => {
          const h = HABITATS[id];
          const selected = id === habitat;
          return (
            <button
              key={id}
              ref={(el) => { refs.current[id] = el; }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={`mp-tile${selected ? ' mp-tile--on' : ''}`}
              onClick={() => setHabitat(id)}
            >
              <span className="mp-tile__label">{h.label}</span>
              {h.assumed && <span className="mp-tile__badge">assumed</span>}
              <span className="mp-tile__stats">
                <span>{h.o2Percent}% O₂</span>
                <span>{h.pressurePsi} psi</span>
                <span>{h.gravityG} g</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
