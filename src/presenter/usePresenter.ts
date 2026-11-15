import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useStore } from '../state/store';
import { GRAVITY_PRESETS, type HabitatId } from '../model/habitats';

/** The scripted demo path. Each id is also the DOM id of the section it scrolls to. */
export const STEPS = ['intro', 'mission', 'flame', 'map', 'ranking', 'gravity', 'compare', 'ask', 'earth'] as const;
export type StepId = (typeof STEPS)[number];

export const STEP_LABELS: Record<StepId, string> = {
  intro: 'Fires in spaceflight',
  mission: 'Mission',
  flame: 'Live flame',
  map: 'Condition map',
  ranking: 'Ranking',
  gravity: 'Gravity bridge',
  compare: 'Compare',
  ask: 'Ask the data',
  earth: 'Back on Earth',
};

/** "03" style number for a step index. */
export const stepNumber = (i: number) => String(i + 1).padStart(2, '0');

export function nextStep(current: number, total: number): number {
  return Math.max(0, Math.min(total - 1, current + 1));
}

export function prevStep(current: number): number {
  return Math.max(0, current - 1);
}

export type PresenterAction = { type: 'next' } | { type: 'prev' } | { type: 'goto'; step: number };

/** Pure step reducer; the hook always reduces against the latest step so rapid presses never drop. */
export function presenterReducer(current: number, action: PresenterAction, total: number = STEPS.length): number {
  switch (action.type) {
    case 'next':
      return nextStep(current, total);
    case 'prev':
      return prevStep(current);
    case 'goto':
      return Math.max(0, Math.min(total - 1, action.step));
  }
}

export type KeyCommand = PresenterAction | { type: 'toggleIndicator' } | { type: 'escape' };
type KeyLike = { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; repeat?: boolean };
/**
 * body: the page itself. text: a text-entry field (owns every key but Esc).
 * line: a single-line <input> (owns every key but Esc, PageUp and PageDown, which do nothing there).
 * widget: owns ←/→/Home/End/Space only (radio group, map, slider, summary). other: buttons, links, etc.
 */
export type TargetInfo = { kind: 'body' | 'text' | 'line' | 'widget' | 'other' };

/** Keys an arrow-owning widget keeps for itself. */
const WIDGET_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End', ' ']);

/** Maps a key press to a presenter command, or null when the presenter must leave it alone. */
export function keyCommand(e: KeyLike, target: TargetInfo): KeyCommand | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const k = e.key;
  // Esc always comes to the presenter: it leaves whatever has focus.
  if (k === 'Escape') return { type: 'escape' };
  if (e.repeat) return null;
  if (target.kind === 'text') return null;
  if (target.kind === 'line') {
    // A clicker's PageUp/PageDown must still move the demo while the Ask box holds focus.
    if (e.shiftKey) return null;
    if (k === 'PageDown') return { type: 'next' };
    if (k === 'PageUp') return { type: 'prev' };
    return null;
  }
  if (target.kind === 'widget' && WIDGET_KEYS.has(k)) return null;
  if (k === 'p' || k === 'P') return { type: 'toggleIndicator' };
  if (e.shiftKey) return null;
  switch (k) {
    case 'ArrowRight':
    case 'PageDown':
      return { type: 'next' };
    case ' ':
      return target.kind === 'body' ? { type: 'next' } : null;
    case 'ArrowLeft':
    case 'PageUp':
      return { type: 'prev' };
    case 'Home':
      return { type: 'goto', step: 0 };
  }
  if (/^[1-9]$/.test(k) && Number(k) <= STEPS.length) return { type: 'goto', step: Number(k) - 1 };
  return null;
}

export const TEXT_ENTRY_SELECTOR =
  'input:not([type="range"]), textarea, select, [contenteditable]:not([contenteditable="false"])';
/** Single-line text inputs (no multi-line, no select, no contenteditable). */
export const SINGLE_LINE_SELECTOR =
  'input:is([type="text"], [type="search"], [type="email"], [type="url"], [type="tel"], [type="password"], [type="number"], :not([type]))';
/** Only the <summary> of a <details> owns keys, never the details body. */
export const ARROW_WIDGET_SELECTOR = '[role="radiogroup"], [role="application"], input[type="range"], summary';

type ElLike = { closest(selector: string): unknown };
type DocLike = { body: unknown; documentElement: unknown };

export function describeTarget(t: unknown, doc: DocLike = document): TargetInfo {
  if (!t || typeof (t as ElLike).closest !== 'function' || t === doc.body || t === doc.documentElement) {
    return { kind: 'body' };
  }
  const el = t as ElLike;
  if (el.closest(TEXT_ENTRY_SELECTOR)) {
    return el.closest(SINGLE_LINE_SELECTOR) ? { kind: 'line' } : { kind: 'text' };
  }
  if (el.closest(ARROW_WIDGET_SELECTOR)) return { kind: 'widget' };
  return { kind: 'other' };
}

/** Esc: drop focus from whatever element holds it, so ←/→ drive the demo again. */
export function escapeFocus(doc: DocLike & { activeElement: unknown }): boolean {
  const a = doc.activeElement as { blur?: unknown } | null;
  if (!a || a === doc.body || a === doc.documentElement || typeof a.blur !== 'function') return false;
  (a as { blur(): void }).blur();
  return true;
}

/**
 * Scroll-sync choice (scrollspy). tops[i] is section i's top edge in viewport px. The step is the
 * last section whose top has passed the reading line. Sections sharing a row (flame | map) are
 * entered at the first one, and the current one is kept while it stays in that row.
 */
export function pickStepInView(tops: number[], current: number, line: number, atBottom = false): number {
  if (atBottom && tops.length) return tops.length - 1;
  let best = 0;
  for (let i = 0; i < tops.length; i++) if (tops[i] <= line) best = i;
  const rowTop = tops[best];
  if (Math.abs((tops[current] ?? Infinity) - rowTop) < 1) return current;
  while (best > 0 && Math.abs(tops[best - 1] - rowTop) < 1) best--;
  return best;
}

export type IntroHandle = { next(): boolean; prev(): boolean };

const MOON_G = GRAVITY_PRESETS.moon;

/**
 * Gravity for the flame drama ramp at progress p (0..1), or null when the ramp must stop
 * because the habitat is no longer the Moon (a manual mission change wins over the ramp).
 */
export function dramaGravity(habitat: HabitatId, p: number): number | null {
  if (habitat !== 'moon') return null;
  const eased = 1 - Math.pow(1 - Math.min(1, Math.max(0, p)), 3);
  return Math.round(MOON_G * eased * 1000) / 1000;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** True once step i's section sits at its scroll position (or the page cannot scroll further). */
function reachedStep(i: number): boolean {
  if (i === 0) return window.scrollY <= 2;
  const el = document.getElementById(STEPS[i]);
  if (!el) return true;
  const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
  const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
  return Math.abs(el.getBoundingClientRect().top - margin) <= 4 || atBottom;
}

export function scrollToStep(i: number) {
  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  if (i === 0) {
    window.scrollTo({ top: 0, behavior });
    return;
  }
  document.getElementById(STEPS[i])?.scrollIntoView({ behavior, block: 'start' });
}

type Options = {
  introRef: RefObject<IntroHandle | null>;
  /** Bumped when the map should return to its pressure axis. */
  onMapReset(): void;
};

/** Owns all presenter keys, step side effects and scroll-sync. */
export function usePresenter({ introRef, onMapReset }: Options) {
  const store = useStore();
  const { step } = store;
  const [indicator, setIndicator] = useState(false);

  // The store's setters are recreated on every state change; read them through a ref so the
  // key listener and scroll observer are attached once instead of on every render.
  const actions = useRef({ store, onMapReset });
  useEffect(() => { actions.current = { store, onMapReset }; });

  // Latest step, updated synchronously on every navigation so two quick presses both count.
  const stepRef = useRef(step);
  useEffect(() => { stepRef.current = step; }, [step]);

  // While a presenter scroll is running, scroll-sync must not report the sections it passes.
  const syncPaused = useRef(false);
  const scrollToken = useRef(0);
  // Flame drama: a timeout and an animation frame, tracked separately so clearing one kind
  // never cancels an unrelated id of the other kind (such as goTo's landing check).
  const dramaTimeout = useRef<number | null>(null);
  const dramaFrame = useRef<number | null>(null);
  /** Stops the gravity ramp; with snap, jumps straight to Moon gravity so no half-ramp value lingers. */
  const cancelDrama = (snap: boolean) => {
    const running = dramaTimeout.current !== null || dramaFrame.current !== null;
    if (dramaTimeout.current !== null) clearTimeout(dramaTimeout.current);
    if (dramaFrame.current !== null) cancelAnimationFrame(dramaFrame.current);
    dramaTimeout.current = null;
    dramaFrame.current = null;
    if (running && snap && actions.current.store.habitat === 'moon') actions.current.store.setCondition({ gravity: MOON_G });
  };

  const runSideEffects = useCallback((id: StepId) => {
    const { setHabitat, setCondition, setCompare } = actions.current.store;
    const { onMapReset } = actions.current;
    switch (id) {
      case 'mission':
        setHabitat('moon');
        break;
      case 'flame': {
        setHabitat('moon');
        if (prefersReducedMotion()) break;
        // Drama: start as an orbital sphere, then settle into lunar gravity.
        setCondition({ gravity: 0 });
        dramaTimeout.current = window.setTimeout(() => {
          dramaTimeout.current = null;
          const t0 = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - t0) / 900);
            const g = dramaGravity(actions.current.store.habitat, p);
            if (g === null) { dramaFrame.current = null; return; }
            setCondition({ gravity: g });
            dramaFrame.current = p < 1 ? requestAnimationFrame(tick) : null;
          };
          dramaFrame.current = requestAnimationFrame(tick);
        }, 1200);
        break;
      }
      case 'map':
        setHabitat('moon');
        onMapReset();
        break;
      case 'compare':
        setCompare('flex', 'bass-ii');
        break;
      case 'ask':
        // Focused once the scroll lands (see goTo), so focus never interrupts the smooth scroll.
        break;
    }
  }, []);

  useEffect(() => () => cancelDrama(false), []);

  /** Presenter navigation: set step, scroll, run side effects. */
  const goTo = useCallback((n: number, sideEffects = true) => {
    const i = presenterReducer(0, { type: 'goto', step: n });
    stepRef.current = i;
    actions.current.store.setStep(i);
    syncPaused.current = true;
    // Any navigation ends a running gravity ramp at its target before anything else changes.
    cancelDrama(true);
    scrollToStep(i);
    if (sideEffects) runSideEffects(STEPS[i]);
    // Resume scroll-sync (and focus Ask) once the section has landed; give up after 3 s.
    const token = ++scrollToken.current;
    const t0 = performance.now();
    const check = () => {
      if (token !== scrollToken.current) return;
      if (!reachedStep(i) && performance.now() - t0 < 3000) { window.setTimeout(check, 50); return; }
      syncPaused.current = false;
      if (sideEffects && STEPS[i] === 'ask') {
        document.querySelector<HTMLInputElement>('#ask .ask__input')?.focus({ preventScroll: true });
      }
    };
    window.setTimeout(check, 50);
  }, [runSideEffects]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const cmd = keyCommand(e, describeTarget(e.target));
      if (!cmd) return;
      if (cmd.type === 'toggleIndicator') { setIndicator((v) => !v); return; }
      if (cmd.type === 'escape') {
        // One Esc always restores ←/→: leave the focused widget or field, then hide the indicator.
        escapeFocus(document);
        setIndicator(false);
        return;
      }
      e.preventDefault();
      const cur = stepRef.current;
      if (STEPS[cur] === 'intro' && cmd.type !== 'goto') {
        const intro = introRef.current;
        if (window.scrollY > 4) scrollToStep(0);
        if (cmd.type === 'next' && intro?.next()) return;
        if (cmd.type === 'prev') { intro?.prev(); return; }
      }
      goTo(presenterReducer(cur, cmd));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, introRef]);

  // Scroll-sync: manual scrolling updates the step (no side effects).
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const els = STEPS.map((id) => document.getElementById(id));
    let timer = 0;
    const measure = () => {
      timer = 0;
      if (syncPaused.current) return;
      const tops = els.map((el) => (el ? el.getBoundingClientRect().top : Infinity));
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
      // Reading line: just below the sticky header, so even the short Mission section registers.
      const next = pickStepInView(tops, stepRef.current, 64 + window.innerHeight * 0.15, atBottom);
      if (next !== stepRef.current) {
        stepRef.current = next;
        actions.current.store.setStep(next);
      }
    };
    // Throttled with a timer, not rAF, so it still settles in a background or throttled tab.
    const schedule = () => { if (!timer) timer = window.setTimeout(measure, 80); };
    const thresholds = Array.from({ length: 11 }, (_, i) => i / 10);
    const io = new IntersectionObserver(schedule, { threshold: thresholds });
    for (const el of els) if (el) io.observe(el);
    // Tall sections can scroll a long way without crossing a threshold; a throttled scroll check covers that.
    window.addEventListener('scroll', schedule, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener('scroll', schedule);
      if (timer) clearTimeout(timer);
    };
  }, []);

  return { step, indicator, goTo };
}
