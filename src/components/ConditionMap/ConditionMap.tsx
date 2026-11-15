import { memo, useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import * as d3 from 'd3';
import { shortName } from '../../data/names';
import type { Dataset, TestPoint } from '../../data/schema';
import { BOUNDARY_CONCLUSION, boundaryEvidence, describeBoundaryEvidence, testsNear } from '../../model/coverage';
import { HABITATS, type Habitat } from '../../model/habitats';
import { boundaryIsMeaningful, boundaryO2, fitLogistic, type FlamModel } from '../../model/logistic';
import { useStore } from '../../state/store';
import { SourceTipCard } from '../Source/SourceTip';
import './conditionMap.css';

export type XAxisMode = 'pressure' | 'flow';

export type ConditionMapProps = {
  dataset: Dataset;
  /** Flammability model; defaults to fitLogistic(dataset.tests). Pass null to force "no model". */
  model?: FlamModel | null;
  xAxis?: XAxisMode;
  /** Changing this number snaps the axis back to xAxis (presenter mode). */
  axisResetKey?: number;
  onSelectInvestigation?(id: string): void;
};

/* ------------------------------------------------------------------ constants */

const HEIGHT = 500;
const M = { top: 18, right: 28, bottom: 52, left: 60 };
/** Pressure axis: 0–16 psi gets most of the width; 16–76 psi is compressed past a break. */
const P_BREAK = 16;
const P_MAX = 76;
const P_BREAK_FRAC = 0.82;
const FLOW_MAX = 50;
const NEAR_DO2 = 3;
const NEAR_DP = 1.5;
const MOON = HABITATS.moon;

/** Categorical palette tuned for the dark background (Okabe-Ito based; all ≥ 4.5:1 on --bg). */
const PALETTE = ['#56b4e9', '#e69f00', '#cc79a7', '#f0e442', '#3fc89a', '#ff8f5c', '#b7a6ff', '#9fd8ff', '#e8e8e8'];

const OUTCOME_LABEL: Record<TestPoint['outcome'], string> = {
  burned: 'Burned',
  no_ignition: 'Did not ignite',
  extinguished: 'Burned, then went out',
  measured: 'Measured (outcome not classified)',
};

/* ------------------------------------------------------------------ helpers */

function fmt(v: number, digits = 1): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(digits);
}

type Plotted = { t: TestPoint; i: number; x: number; y: number };

type HabitatGroup = { key: string; o2: number; p: number; members: Habitat[] };

function habitatGroups(): HabitatGroup[] {
  const groups = new Map<string, HabitatGroup>();
  for (const h of Object.values(HABITATS)) {
    const key = `${h.o2Percent}|${h.pressurePsi}`;
    const g = groups.get(key) ?? { key, o2: h.o2Percent, p: h.pressurePsi, members: [] };
    g.members.push(h);
    groups.set(key, g);
  }
  return [...groups.values()];
}

const HAB_GROUPS = habitatGroups();

function habLabel(h: Habitat): string {
  return h.assumed ? `${h.label} (assumed)` : h.label;
}

/* ------------------------------------------------------------------ marks */

function PointMark({ outcome, color, dashed }: { outcome: TestPoint['outcome']; color: string; dashed: boolean }) {
  const dash = dashed ? '2 2' : undefined;
  switch (outcome) {
    case 'burned':
      return <circle r={4} fill={color} stroke={dashed ? color : 'none'} strokeDasharray={dash} fillOpacity={dashed ? 0.35 : 0.9} />;
    case 'no_ignition':
      return (
        <g stroke={color} strokeWidth={1.6} fill="none">
          <path d="M-3.5,-3.5L3.5,3.5M-3.5,3.5L3.5,-3.5" strokeDasharray={dashed ? '1.5 1.5' : undefined} />
        </g>
      );
    case 'extinguished':
      return (
        <g>
          <circle r={2.6} fill={color} fillOpacity={dashed ? 0.4 : 0.95} />
          <circle r={5} fill="none" stroke={color} strokeWidth={1.2} strokeOpacity={0.85} strokeDasharray={dash} />
        </g>
      );
    case 'measured':
      return <circle r={2} fill={color} fillOpacity={dashed ? 0.45 : 0.8} />;
  }
}

/**
 * All test points. Memoised and independent of the store's o2 / pressure / flow and of the
 * hovered point, so slider-driven crosshair updates never re-render ~1000 point nodes.
 * Pointer handling is delegated through data-i attributes.
 */
const PointsLayer = memo(function PointsLayer({
  points,
  mode,
  colorOf,
  onHover,
  onSelect,
}: {
  points: Plotted[];
  mode: XAxisMode;
  colorOf(id: string): string;
  onHover(i: number | null): void;
  onSelect(i: number): void;
}) {
  const indexOf = (e: MouseEvent<SVGGElement>): number | null => {
    const el = (e.target as Element).closest('[data-i]');
    return el ? Number(el.getAttribute('data-i')) : null;
  };
  return (
    <g
      className="cmap__points"
      onMouseOver={(e) => onHover(indexOf(e))}
      onMouseLeave={() => onHover(null)}
      onClick={(e) => {
        const i = indexOf(e);
        if (i !== null) onSelect(i);
      }}
    >
      {points.map((p) => (
        <g key={`${mode}-${p.i}`} data-i={p.i} className="cmap__pt" transform={`translate(${p.x},${p.y})`}>
          <circle r={8} className="cmap__hit" />
          <PointMark outcome={p.t.outcome} color={colorOf(p.t.investigationId)} dashed={p.t.o2Basis === 'burner_stream'} />
        </g>
      ))}
    </g>
  );
});

const PAGE_STEP = 10;

/* ------------------------------------------------------------------ component */

export function ConditionMap({ dataset, model: modelProp, xAxis = 'pressure', axisResetKey = 0, onSelectInvestigation }: ConditionMapProps) {
  const store = useStore();
  const [mode, setMode] = useState<XAxisMode>(xAxis);
  const [showBurner, setShowBurner] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [width, setWidth] = useState(900);
  const [resizing, setResizing] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const whyId = useId();

  // Follow the xAxis prop when the parent changes it (derived-state pattern, no effect).
  const [prevXAxis, setPrevXAxis] = useState(xAxis);
  const [prevResetKey, setPrevResetKey] = useState(axisResetKey);
  if (prevXAxis !== xAxis || prevResetKey !== axisResetKey) {
    setPrevXAxis(xAxis);
    setPrevResetKey(axisResetKey);
    setMode(xAxis);
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // While the width changes, suppress position transitions so marks snap instead of gliding.
    const ro = new ResizeObserver(([entry]) => {
      setResizing(true);
      setWidth(Math.max(320, Math.round(entry.contentRect.width)));
      clearTimeout(timer);
      timer = setTimeout(() => setResizing(false), 200);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      clearTimeout(timer);
    };
  }, []);

  const model = useMemo(
    () => (modelProp === undefined ? fitLogistic(dataset.tests) : modelProp),
    [dataset, modelProp],
  );
  const showBoundary = model !== null && boundaryIsMeaningful(model);
  const evidence = useMemo(() => boundaryEvidence(dataset.tests), [dataset]);

  const invById = useMemo(() => new Map(dataset.investigations.map((inv) => [inv.id, inv])), [dataset]);

  /** Colours keyed by investigation, in dataset order, for investigations that have tests. */
  const colorOf = useMemo(() => {
    const ids = dataset.investigations.map((i) => i.id).filter((id) => dataset.tests.some((t) => t.investigationId === id));
    const map = new Map(ids.map((id, k) => [id, PALETTE[k % PALETTE.length]]));
    return (id: string) => map.get(id) ?? '#e8e8e8';
  }, [dataset]);

  const innerW = width - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;

  const xScale = useMemo(
    () =>
      mode === 'pressure'
        ? d3.scaleLinear().domain([0, P_BREAK, P_MAX]).range([0, innerW * P_BREAK_FRAC, innerW]).clamp(true)
        : d3.scaleLinear().domain([0, FLOW_MAX]).range([0, innerW]).clamp(true),
    [mode, innerW],
  );
  const yScale = useMemo(() => d3.scaleLinear().domain([0, 100]).range([innerH, 0]), [innerH]);

  const xTicks = useMemo(
    () => (mode === 'pressure' ? [...d3.range(0, P_BREAK + 1, 2), 30, 45, 60, 75] : xScale.ticks(10)),
    [mode, xScale],
  );

  const xOf = (t: TestPoint) => (mode === 'pressure' ? t.pressurePsi : t.flowCmS);

  const candidates = useMemo(
    () => dataset.tests.filter((t) => showBurner || t.o2Basis === 'ambient'),
    [dataset, showBurner],
  );
  const hiddenBurner = dataset.tests.length - candidates.length;

  const plotted: Plotted[] = useMemo(() => {
    const out: Plotted[] = [];
    dataset.tests.forEach((t, i) => {
      if (!showBurner && t.o2Basis !== 'ambient') return;
      const xv = mode === 'pressure' ? t.pressurePsi : t.flowCmS;
      if (xv === null) return;
      out.push({ t, i, x: xScale(xv), y: yScale(t.o2Percent) });
    });
    // Draw order: burner-stream points first so ambient points paint on top of them.
    const rank = (p: Plotted) => (p.t.o2Basis === 'burner_stream' ? 0 : 1);
    return out.sort((a, b) => rank(a) - rank(b));
  }, [dataset, showBurner, mode, xScale, yScale]);

  /** Keyboard order: grouped by investigation (dataset order), then left-to-right, top-down. */
  const navOrder: Plotted[] = useMemo(() => {
    const invRank = new Map(dataset.investigations.map((inv, k) => [inv.id, k]));
    return [...plotted].sort(
      (a, b) =>
        (invRank.get(a.t.investigationId) ?? 0) - (invRank.get(b.t.investigationId) ?? 0) ||
        a.x - b.x ||
        a.y - b.y,
    );
  }, [plotted, dataset]);
  const byIndex = useMemo(() => new Map(plotted.map((p) => [p.i, p])), [plotted]);
  const notPlotted = candidates.filter((t) => xOf(t) === null).length;

  const visibleInvs = useMemo(() => {
    const ids = new Set(plotted.map((p) => p.t.investigationId));
    return dataset.investigations.filter((inv) => ids.has(inv.id));
  }, [plotted, dataset]);

  const selected = HABITATS[store.habitat];
  const near = useMemo(
    () => testsNear(dataset.tests, selected.o2Percent, selected.pressurePsi, NEAR_DO2, NEAR_DP),
    [dataset, selected],
  );

  /* boundary curves (only when the model is meaningful) */
  const boundary = useMemo(() => {
    if (!showBoundary || !model || mode !== 'pressure') return null;
    const ps = d3.range(0.5, P_BREAK + 0.01, 0.25);
    const line = (p: number) =>
      d3
        .line<number>()
        .defined((psi) => Number.isFinite(boundaryO2(model, psi, p)))
        .x((psi) => xScale(psi))
        .y((psi) => yScale(Math.max(0, Math.min(100, boundaryO2(model, psi, p)))))(ps);
    const band = d3
      .area<number>()
      .x((psi) => xScale(psi))
      .y0((psi) => yScale(Math.max(0, Math.min(100, boundaryO2(model, psi, 0.2)))))
      .y1((psi) => yScale(Math.max(0, Math.min(100, boundaryO2(model, psi, 0.8)))))(ps);
    const sources = model.sourceIds.map((id) => (invById.get(id) ? shortName(invById.get(id)!) : id));
    const labelY = yScale(Math.max(0, Math.min(100, boundaryO2(model, 0.5, 0.2))));
    return { mid: line(0.5), band, label: `Fit to ${model.n} tests from ${sources.join(', ')}`, labelY };
  }, [showBoundary, model, mode, xScale, yScale, invById]);

  const activePt = active === null ? null : byIndex.get(active) ?? null;

  // Stable callbacks for the memoised points layer.
  const selectRef = useRef(onSelectInvestigation);
  const testsRef = useRef(dataset.tests);
  useEffect(() => {
    selectRef.current = onSelectInvestigation;
    testsRef.current = dataset.tests;
  });
  const onHover = useCallback((i: number | null) => setActive(i), []);
  const onSelectPoint = useCallback((i: number) => {
    const t = testsRef.current[i];
    if (t) selectRef.current?.(t.investigationId);
  }, []);

  function onKey(e: KeyboardEvent<SVGRectElement>) {
    const n = navOrder.length;
    if (n === 0) return;
    const idx = activePt ? navOrder.indexOf(activePt) : -1;
    const go = (k: number) => {
      e.preventDefault();
      setActive(navOrder[((k % n) + n) % n].i);
    };
    const step = e.shiftKey ? PAGE_STEP : 1;
    const invOf = (k: number) => navOrder[k].t.investigationId;
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        return go(idx < 0 ? 0 : idx + step);
      case 'ArrowLeft':
      case 'ArrowUp':
        return go(idx < 0 ? n - 1 : idx - step);
      case 'Home':
        return go(0);
      case 'End':
        return go(n - 1);
      case 'PageDown': {
        // First point of the next investigation (wraps).
        if (idx < 0) return go(0);
        let k = idx;
        while (k < n && invOf(k) === invOf(idx)) k++;
        return go(k >= n ? 0 : k);
      }
      case 'PageUp': {
        // First point of this investigation, or of the previous one if already there (wraps).
        if (idx < 0) return go(n - 1);
        let k = idx;
        while (k > 0 && invOf(k - 1) === invOf(idx)) k--;
        if (k !== idx) return go(k);
        const prev = (k - 1 + n) % n;
        let j = prev;
        while (j > 0 && invOf(j - 1) === invOf(prev)) j--;
        return go(j);
      }
      case 'Enter':
      case ' ':
        if (activePt) {
          e.preventDefault();
          onSelectInvestigation?.(activePt.t.investigationId);
        }
        return;
      case 'Escape':
        setActive(null);
        return;
    }
  }

  const invName = (id: string) => invById.get(id)?.name ?? id;
  const liveText = activePt
    ? [
        `${navOrder.indexOf(activePt) + 1} of ${navOrder.length}.`,
        `${invName(activePt.t.investigationId)}.`,
        `O2 ${fmt(activePt.t.o2Percent)} percent${activePt.t.o2Basis === 'burner_stream' ? ', burner stream' : ''}.`,
        `Pressure ${activePt.t.pressurePsi === null ? 'not reported' : `${fmt(activePt.t.pressurePsi, 2)} psi`}.`,
        mode === 'flow' && activePt.t.flowCmS !== null ? `Flow ${fmt(activePt.t.flowCmS)} centimetres per second.` : '',
        `Outcome: ${OUTCOME_LABEL[activePt.t.outcome]}.`,
      ]
        .filter(Boolean)
        .join(' ')
    : '';
  const whyText = `${describeBoundaryEvidence(evidence, (id) => (invById.get(id) ? shortName(invById.get(id)!) : id))} ${BOUNDARY_CONCLUSION}`;

  /* crosshair */
  const crossX = xScale(mode === 'pressure' ? store.pressure : store.flow);
  const crossY = yScale(store.o2);

  /* moon zone, gap box */
  const zone = {
    x0: xScale(0),
    x1: xScale(MOON.pressurePsi),
    y0: yScale(100),
    y1: yScale(MOON.o2Percent),
  };
  const box = {
    x0: xScale(Math.max(0, selected.pressurePsi - NEAR_DP)),
    x1: xScale(selected.pressurePsi + NEAR_DP),
    y0: yScale(Math.min(100, selected.o2Percent + NEAR_DO2)),
    y1: yScale(Math.max(0, selected.o2Percent - NEAR_DO2)),
  };

  const tipLeft = activePt ? M.left + activePt.x : 0;
  const tipTop = activePt ? M.top + activePt.y : 0;
  const tipFlip = activePt ? tipLeft > width * 0.6 : false;

  return (
    <section className={`cmap${resizing ? ' is-resizing' : ''}`} aria-labelledby={`${whyId}-title`}>
      <header className="cmap__head">
        <div>
          <h2 id={`${whyId}-title`} className="cmap__title">Where the data is</h2>
          <p className="cmap__sub">Every PSI microgravity test, by oxygen and {mode === 'pressure' ? 'pressure' : 'airflow'}</p>
        </div>
        <div className="cmap__headline" aria-live="polite">
          <span className={`cmap__count${near.length === 0 ? ' cmap__count--zero' : ''}`}>{near.length}</span>
          <span className="cmap__count-label">
            tests near <strong>{habLabel(selected)}</strong> conditions
            <span className="cmap__count-def">
              within ±{NEAR_DO2}% O2 and ±{NEAR_DP} psi of {selected.o2Percent}% / {selected.pressurePsi} psi
            </span>
          </span>
        </div>
      </header>

      <div className="cmap__controls">
        <div className="cmap__seg" role="group" aria-label="Horizontal axis">
          <button type="button" aria-pressed={mode === 'pressure'} onClick={() => setMode('pressure')}>
            Pressure (psi)
          </button>
          <button type="button" aria-pressed={mode === 'flow'} onClick={() => setMode('flow')}>
            Airflow (cm/s)
          </button>
        </div>
        <label className="cmap__check">
          <input type="checkbox" checked={showBurner} onChange={(e) => setShowBurner(e.currentTarget.checked)} />
          <span>Show inverse-flame tests (burner-stream O2, not ambient)</span>
        </label>
      </div>

      <div className="cmap__plot" ref={wrapRef}>
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label={`Scatter of ${plotted.length} tests: oxygen percent against ${mode === 'pressure' ? 'pressure in psi' : 'airflow in cm/s'}, with habitat atmospheres marked.`}
        >
          <defs>
            <pattern id={`${whyId}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="8" stroke="var(--accent-neutral)" strokeOpacity="0.12" strokeWidth="3" />
            </pattern>
            <clipPath id={`${whyId}-clip`}>
              <rect x={-6} y={-6} width={innerW + 12} height={innerH + 12} />
            </clipPath>
          </defs>
          <g transform={`translate(${M.left},${M.top})`}>
            {/* grid + axes */}
            <g className="cmap__grid" key={`grid-${mode}`}>
              {yScale.ticks(10).map((v) => (
                <g key={`y${v}`} transform={`translate(0,${yScale(v)})`}>
                  <line x2={innerW} />
                  <text x={-10} dy="0.32em" textAnchor="end">{v}</text>
                </g>
              ))}
              {xTicks.map((v) => (
                <g key={`x${v}`} transform={`translate(${xScale(v)},0)`}>
                  <line y2={innerH} />
                  <text y={innerH + 20} textAnchor="middle">{v}</text>
                </g>
              ))}
              {mode === 'pressure' && (
                <g className="cmap__break" transform={`translate(${xScale(P_BREAK)},0)`}>
                  <rect x={0} y={0} width={innerW - xScale(P_BREAK)} height={innerH} />
                  <path d={`M-5,${innerH + 6}l5,-12M1,${innerH + 6}l5,-12`} />
                  <text x={(innerW - xScale(P_BREAK)) / 2} y={innerH - 10} textAnchor="middle">compressed scale</text>
                </g>
              )}
            </g>
            <text className="cmap__axis-label" x={innerW / 2} y={innerH + 44} textAnchor="middle">
              {mode === 'pressure' ? 'Pressure (psi)' : 'Airflow (cm/s)'}
            </text>
            <text className="cmap__axis-label" transform={`translate(${-44},${innerH / 2}) rotate(-90)`} textAnchor="middle">
              Oxygen (%)
            </text>

            <g clipPath={`url(#${whyId}-clip)`}>
              {/* Moon-base region */}
              {mode === 'pressure' ? (
                <g className="cmap__zone">
                  <rect x={zone.x0} y={zone.y0} width={zone.x1 - zone.x0} height={zone.y1 - zone.y0} fill={`url(#${whyId}-hatch)`} />
                  <rect x={zone.x0} y={zone.y0} width={zone.x1 - zone.x0} height={zone.y1 - zone.y0} className="cmap__zone-edge" />
                  <text x={zone.x0 + 10} y={zone.y1 - 30}>Moon-base atmospheres</text>
                  <text x={zone.x0 + 10} y={zone.y1 - 12} className="cmap__zone-sub">≥{MOON.o2Percent}% O2, ≤{MOON.pressurePsi} psi</text>
                </g>
              ) : (
                <g className="cmap__hlines">
                  {HAB_GROUPS.map((g) => (
                    <g key={g.key} transform={`translate(0,${yScale(g.o2)})`}>
                      <line x2={innerW} />
                      <text x={innerW - 6} y={g.o2 > 90 ? 18 : -7} textAnchor="end">
                        {g.members.map(habLabel).join(' · ')} ({g.o2}% O2)
                      </text>
                    </g>
                  ))}
                </g>
              )}

              {/* fitted boundary (only when meaningful) */}
              {boundary && (
                <g className="cmap__boundary">
                  {boundary.band && <path d={boundary.band} className="cmap__band" />}
                  {boundary.mid && <path d={boundary.mid} className="cmap__mid" />}
                  <text x={xScale(0.5) + 4} y={Math.min(innerH - 8, boundary.labelY + 18)}>{boundary.label}</text>
                </g>
              )}

              {/* gap box around the selected habitat */}
              {mode === 'pressure' && (
                <rect
                  className="cmap__gapbox"
                  x={box.x0}
                  y={box.y0}
                  width={box.x1 - box.x0}
                  height={box.y1 - box.y0}
                />
              )}

              {/* points */}
              <PointsLayer points={plotted} mode={mode} colorOf={colorOf} onHover={onHover} onSelect={onSelectPoint} />
              {activePt && <circle className="cmap__active" r={8} cx={activePt.x} cy={activePt.y} />}

              {/* habitats */}
              {mode === 'pressure' && (
                <g className="cmap__habs">
                  {HAB_GROUPS.map((g) => {
                    const isSel = g.members.some((h) => h.id === store.habitat);
                    const hx = xScale(g.p);
                    const hy = yScale(g.o2);
                    const leftSide = hx > innerW * 0.55;
                    const below = g.o2 > 90;
                    return (
                      <g key={g.key} className={`cmap__hab${isSel ? ' is-selected' : ''}`} style={{ transform: `translate(${hx}px, ${hy}px)` }}>
                        {isSel && <circle r={9} className="cmap__pulse" />}
                        <rect x={-6} y={-6} width={12} height={12} transform="rotate(45)" className="cmap__diamond" />
                        <text
                          x={leftSide ? -14 : 14}
                          y={below ? 22 : -12}
                          textAnchor={leftSide ? 'end' : 'start'}
                        >
                          {g.members.map((h: Habitat, k) => (
                            <tspan key={h.id} className={h.id === store.habitat ? 'is-sel' : undefined}>
                              {k > 0 ? ' · ' : ''}
                              {habLabel(h)}
                            </tspan>
                          ))}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}

              {/* crosshair */}
              <g className="cmap__cross">
                <line className="cmap__cross-v" style={{ transform: `translateX(${crossX}px)` }} y1={0} y2={innerH} />
                <line className="cmap__cross-h" style={{ transform: `translateY(${crossY}px)` }} x1={0} x2={innerW} />
                <circle className="cmap__cross-dot" r={4} style={{ transform: `translate(${crossX}px, ${crossY}px)` }} />
              </g>
            </g>

            {/* keyboard focus target over the plot area */}
            <rect
              className="cmap__focus"
              width={innerW}
              height={innerH}
              tabIndex={0}
              role="application"
              aria-roledescription="scatter plot"
              aria-label={`${navOrder.length} test points`}
              aria-describedby={`${whyId}-keys ${whyId}-live`}
              onKeyDown={onKey}
              onBlur={() => setActive(null)}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        </svg>
        <p id={`${whyId}-keys`} className="cmap__sr">
          Arrow keys step through tests (Shift for 10 at a time). Page Up and Page Down jump between investigations.
          Home and End go to the first and last test. Enter opens the investigation. Escape clears.
        </p>
        <p id={`${whyId}-live`} className="cmap__sr" aria-live="polite" aria-atomic="true">
          {liveText}
        </p>

        {/* no-boundary callout */}
        {!showBoundary && mode === 'pressure' && (
          <div className="cmap__callout" style={{ right: M.right + 12, top: M.top + 12 }}>
            <div className="cmap__callout-head">
              <strong>No reliable flammability boundary</strong>
              <button
                type="button"
                className="cmap__why"
                aria-expanded={whyOpen}
                aria-controls={`${whyId}-why`}
                onClick={() => setWhyOpen((o) => !o)}
              >
                {whyOpen ? 'Hide' : 'Why?'}
              </button>
            </div>
            <AnimatePresence initial={false}>
              {whyOpen && (
                <motion.p
                  id={`${whyId}-why`}
                  className="cmap__why-text"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                >
                  {whyText}
                </motion.p>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* tooltip */}
        {activePt && (
          <div
            className="cmap__tip"
            style={{
              left: tipFlip ? undefined : tipLeft + 14,
              right: tipFlip ? width - tipLeft + 14 : undefined,
              top: Math.min(tipTop - 10, HEIGHT - 230),
            }}
          >
            <SourceTipCard
              source={activePt.t.source}
              confidence="derived"
              note="From a PSI experimental table row; units converted to % O2 and psi where needed."
              title={
                <span>
                  <span className="cmap__swatch" style={{ background: colorOf(activePt.t.investigationId) }} />
                  {invById.get(activePt.t.investigationId)?.name ?? activePt.t.investigationId}
                </span>
              }
            >
              <dl className="cmap__tip-dl">
                <dt>O2</dt>
                <dd>
                  {fmt(activePt.t.o2Percent)}%{activePt.t.o2Basis === 'burner_stream' ? ' (burner stream, not ambient)' : ''}
                </dd>
                <dt>Pressure</dt>
                <dd>{activePt.t.pressurePsi === null ? 'not reported' : `${fmt(activePt.t.pressurePsi, 2)} psi`}</dd>
                <dt>Flow</dt>
                <dd>{activePt.t.flowCmS === null ? 'not reported' : `${fmt(activePt.t.flowCmS)} cm/s`}</dd>
                <dt>Fuel</dt>
                <dd>{activePt.t.fuel}</dd>
                <dt>Outcome</dt>
                <dd>{OUTCOME_LABEL[activePt.t.outcome]}</dd>
                {activePt.t.measured && (
                  <>
                    <dt>Measured</dt>
                    <dd>
                      {activePt.t.measured.name}: {activePt.t.measured.value} {activePt.t.measured.unit}
                    </dd>
                  </>
                )}
              </dl>
              <span className="cmap__tip-hint">Click to open this investigation</span>
            </SourceTipCard>
          </div>
        )}
      </div>

      <footer className="cmap__foot">
        <ul className="cmap__legend" aria-label="Investigations">
          {visibleInvs.map((inv) => (
            <li key={inv.id}>
              <span className="cmap__swatch" style={{ background: colorOf(inv.id) }} />
              {shortName(inv)}
            </li>
          ))}
        </ul>
        <ul className="cmap__legend cmap__legend--shapes" aria-label="Outcomes">
          {(['burned', 'no_ignition', 'extinguished', 'measured'] as const).map((o) => (
            <li key={o}>
              <svg width={16} height={16} viewBox="-8 -8 16 16" aria-hidden="true">
                <PointMark outcome={o} color="var(--accent-neutral)" dashed={false} />
              </svg>
              {OUTCOME_LABEL[o]}
            </li>
          ))}
          {showBurner && (
            <li>
              <svg width={16} height={16} viewBox="-8 -8 16 16" aria-hidden="true">
                <PointMark outcome="burned" color="var(--accent-neutral)" dashed />
              </svg>
              Burner-stream O2
            </li>
          )}
          <li>
            <svg width={16} height={16} viewBox="-8 -8 16 16" aria-hidden="true">
              <rect x={-4.5} y={-4.5} width={9} height={9} transform="rotate(45)" className="cmap__diamond" />
            </svg>
            Habitat atmosphere
          </li>
        </ul>
        <p className="cmap__note">
          {notPlotted} tests not plotted (no {mode === 'pressure' ? 'pressure' : 'flow'} value reported).
          {!showBurner && hiddenBurner > 0 && ` ${hiddenBurner} inverse-flame tests hidden.`}
          {mode === 'pressure' && ' Pressures above 16 psi are compressed past the break.'}
        </p>
      </footer>
    </section>
  );
}

export default ConditionMap;
