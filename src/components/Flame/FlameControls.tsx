import { useId, type CSSProperties } from 'react';
import { GRAVITY_PRESETS } from '../../model/habitats';
import { useStore } from '../../state/store';
import './flame.css';

type SliderProps = {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  digits: number;
  onChange(v: number): void;
};

function Slider({ label, unit, value, min, max, step, digits, onChange }: SliderProps) {
  const id = useId();
  const fill = ((value - min) / (max - min)) * 100;
  return (
    <div className="fc-row">
      <div className="fc-row__head">
        <label htmlFor={id} className="fc-row__label">{label}</label>
        <output htmlFor={id} className="fc-row__value">
          {value.toFixed(digits)}
          <span className="fc-row__unit">{unit}</span>
        </output>
      </div>
      <input
        id={id}
        className="fc-range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--fill': `${Math.min(100, Math.max(0, fill))}%` } as CSSProperties}
        onChange={(e) => onChange(Number(e.currentTarget.value))}
      />
      <div className="fc-row__scale" aria-hidden="true">
        <span>{min}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

const PRESETS: { label: string; value: number }[] = [
  { label: '0 g', value: GRAVITY_PRESETS.micro },
  { label: 'Moon', value: GRAVITY_PRESETS.moon },
  { label: 'Mars', value: GRAVITY_PRESETS.mars },
  { label: 'Earth', value: GRAVITY_PRESETS.earth },
];

export function FlameControls() {
  const { o2, pressure, flow, gravity, setCondition } = useStore();
  return (
    <section className="flame-controls" aria-label="Flame conditions">
      <Slider label="Oxygen" unit="%" value={o2} min={10} max={100} step={1} digits={0}
        onChange={(v) => setCondition({ o2: v })} />
      <Slider label="Pressure" unit="psi" value={pressure} min={1} max={15} step={0.1} digits={1}
        onChange={(v) => setCondition({ pressure: v })} />
      <Slider label="Airflow" unit="cm/s" value={flow} min={0} max={50} step={1} digits={0}
        onChange={(v) => setCondition({ flow: v })} />
      <div className="fc-gravity">
        <Slider label="Gravity" unit="g" value={gravity} min={0} max={1} step={0.001} digits={3}
          onChange={(v) => setCondition({ gravity: v })} />
        <div className="fc-presets" role="group" aria-label="Gravity presets">
          {PRESETS.map((p) => {
            const active = Math.abs(gravity - p.value) < 0.0005;
            return (
              <button
                key={p.label}
                type="button"
                className="fc-preset"
                aria-pressed={active}
                onClick={() => setCondition({ gravity: p.value })}
              >
                <span>{p.label}</span>
                <span className="fc-preset__val">{p.value} g</span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default FlameControls;
