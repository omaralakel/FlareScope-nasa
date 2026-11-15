import { useCallback, useEffect, useId, useImperativeHandle, useRef, useState, type FocusEvent, type MouseEvent, type Ref } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { dataset } from '../../data/dataset';
import { INCIDENTS, type Incident } from '../../data/incidents';
import { shortName } from '../../data/names';
import type { IntroHandle } from '../../presenter/usePresenter';
import './storyIntro.css';

type Props = {
  onDone: () => void;
  /** Milliseconds each step stays before auto-advancing. 0 disables auto-advance. */
  stepMs?: number;
  /** Presenter control: next()/prev() return false at the ends. The presenter owns the keys. */
  ref?: Ref<IntroHandle>;
};

const NAMES = new Map(dataset.investigations.map((i) => [i.id, shortName(i)]));
const CLOSING = INCIDENTS.length; // step index of the closing line
const EASE = [0.22, 1, 0.36, 1] as const;

/** Links in the incident: stem down, rail across, then the investigation chips. */
function Connector({ incident, animate }: { incident: Incident; animate: boolean }) {
  const t = (d: number, dur = 0.5) => (animate ? { delay: d, duration: dur, ease: EASE } : { duration: 0 });
  const n = incident.links.length;
  const whyId = useId();
  const [activeId, setActiveId] = useState(incident.links[0]?.id);
  const active = incident.links.find((l) => l.id === activeId) ?? incident.links[0];
  return (
    <div className="si-links">
      <motion.span
        className="si-links__stem"
        aria-hidden="true"
        initial={{ scaleY: animate ? 0 : 1 }}
        animate={{ scaleY: 1 }}
        transition={t(0.9, 0.4)}
      />
      <motion.span
        className="si-links__rail"
        aria-hidden="true"
        style={{ width: n > 1 ? `${Math.min(100, n * 15)}%` : 0 }}
        initial={{ scaleX: animate ? 0 : 1 }}
        animate={{ scaleX: 1 }}
        transition={t(1.25, 0.5)}
      />
      <p className="si-links__label">In the PSI data</p>
      {animate ? (
        <>
          <ul className="si-chips" aria-label={`Investigations linked to ${incident.title}`}>
            {incident.links.map((l, i) => (
              <motion.li
                key={l.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={t(1.6 + i * 0.09, 0.4)}
              >
                <button
                  type="button"
                  className={`si-chip${l.id === active?.id ? ' si-chip--on' : ''}`}
                  aria-pressed={l.id === active?.id}
                  aria-describedby={l.id === active?.id ? whyId : undefined}
                  onMouseEnter={() => setActiveId(l.id)}
                  onFocus={() => setActiveId(l.id)}
                  onClick={() => setActiveId(l.id)}
                >
                  {NAMES.get(l.id) ?? l.id}
                </button>
              </motion.li>
            ))}
          </ul>
          {active && (
            <motion.p
              id={whyId}
              className="si-why"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={t(1.6 + n * 0.09, 0.4)}
            >
              <span className="si-why__name">{NAMES.get(active.id) ?? active.id}:</span> {active.why}
            </motion.p>
          )}
        </>
      ) : (
        <ul className="si-whys" aria-label={`Investigations linked to ${incident.title}`}>
          {incident.links.map((l) => (
            <li key={l.id}>
              <span className="si-chip">{NAMES.get(l.id) ?? l.id}</span> <span className="si-whys__text">{l.why}</span>
            </li>
          ))}
        </ul>
      )}
      {incident.scopeNote && <p className="si-scope">{incident.scopeNote}</p>}
    </div>
  );
}

function IncidentView({ incident, animate }: { incident: Incident; animate: boolean }) {
  const t = (d: number) => (animate ? { delay: d, duration: 0.6, ease: EASE } : { duration: 0 });
  const rise = { initial: { opacity: animate ? 0 : 1, y: animate ? 12 : 0 }, animate: { opacity: 1, y: 0 } };
  return (
    <article className="si-incident" aria-labelledby={`si-${incident.id}`}>
      <motion.p className="si-incident__year" {...rise} transition={t(0)}>{incident.when}</motion.p>
      <motion.h2 className="si-incident__title" id={`si-${incident.id}`} {...rise} transition={t(0.1)}>
        {incident.title}
      </motion.h2>
      <motion.p className="si-incident__mode" {...rise} transition={t(0.2)}>{incident.failureMode}</motion.p>
      <motion.p className="si-incident__summary" {...rise} transition={t(0.3)}>{incident.summary}</motion.p>
      {incident.quote && (
        <motion.blockquote className="si-quote" {...rise} transition={t(0.45)}>
          <p>&ldquo;{incident.quote.text}&rdquo;</p>
          <cite>{incident.quote.by}</cite>
        </motion.blockquote>
      )}
      <motion.a
        className="si-source"
        href={incident.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e: MouseEvent) => e.stopPropagation()}
        {...rise}
        transition={t(0.5)}
      >
        Source: {incident.sourceLabel}
      </motion.a>
      <Connector incident={incident} animate={animate} />
    </article>
  );
}

function Closing({ onDone, animate }: { onDone: () => void; animate: boolean }) {
  const t = (d: number) => (animate ? { delay: d, duration: 0.7, ease: EASE } : { duration: 0 });
  const rise = { initial: { opacity: animate ? 0 : 1, y: animate ? 10 : 0 }, animate: { opacity: 1, y: 0 } };
  return (
    <div className="si-closing">
      <motion.p className="si-closing__line" {...rise} transition={t(0.1)}>
        The data exists. <span>It's just buried.</span>
      </motion.p>
      <motion.p className="si-closing__sub" {...rise} transition={t(0.6)}>
        {dataset.investigations.length} NASA combustion investigations sit in the Physical Sciences Informatics
        repository. FlameScope digs them out for the mission you pick.
      </motion.p>
      <motion.button
        type="button"
        className="si-cta"
        onClick={(e: MouseEvent) => { e.stopPropagation(); onDone(); }}
        {...rise}
        transition={t(1)}
      >
        Pick a mission
      </motion.button>
    </div>
  );
}

export function StoryIntro({ onDone, stepMs = 9000, ref }: Props) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [done, setDone] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  // Once the presenter drives the intro by keys, auto-advance stops.
  const [manual, setManual] = useState(false);
  const rootRef = useRef<HTMLElement>(null);
  // Mirrors step synchronously so two quick presenter presses both count.
  const stepRef = useRef(0);
  const go = useCallback((n: number) => { stepRef.current = n; setStep(n); }, []);

  const finish = useCallback(() => { setDone(true); onDone(); }, [onDone]);
  const next = useCallback(() => go(Math.min(CLOSING, stepRef.current + 1)), [go]);

  useImperativeHandle(ref, () => ({
    next() {
      setManual(true);
      if (reduce || stepRef.current >= CLOSING) return false;
      go(stepRef.current + 1);
      return true;
    },
    prev() {
      setManual(true);
      if (reduce || stepRef.current <= 0) return false;
      go(stepRef.current - 1);
      return true;
    },
  }), [reduce, go]);

  // Auto-advance only runs while the intro is on screen.
  useEffect(() => {
    const el = rootRef.current;
    // Without IntersectionObserver we cannot tell if the intro is on screen, so auto-advance stays off.
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio > 0.5), { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Gentle auto-advance; any manual step restarts the timer. Stops on the closing line,
  // after onDone, and pauses while the pointer is over the intro or focus is inside it.
  const paused = hovered || focused;
  useEffect(() => {
    if (reduce || !visible || done || manual || paused || !stepMs || step >= CLOSING) return;
    const id = window.setTimeout(next, stepMs);
    return () => window.clearTimeout(id);
  }, [reduce, visible, done, manual, paused, stepMs, step, next]);

  const onBlur = (e: FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
  };

  if (reduce) {
    return (
      <section className="si si--static" aria-label="Fires in spaceflight">
        <p className="si-kicker">Fires in spaceflight</p>
        <div className="si-static-list">
          {INCIDENTS.map((inc) => <IncidentView key={inc.id} incident={inc} animate={false} />)}
        </div>
        <Closing onDone={finish} animate={false} />
      </section>
    );
  }

  const onStageClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    next();
  };

  return (
    <section
      ref={rootRef}
      className="si"
      aria-label="Fires in spaceflight"
      aria-roledescription="story"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={onBlur}
    >
      <div className="si-top">
        <p className="si-kicker">Fires in spaceflight</p>
        <button type="button" className="si-skip" onClick={finish}>Skip to missions</button>
      </div>

      <ol className="si-timeline" aria-label="Timeline">
        {INCIDENTS.map((inc, i) => (
          <li key={inc.id} className={`si-tick${i === step ? ' si-tick--on' : ''}${i < step ? ' si-tick--past' : ''}`}>
            <button type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined}>
              <span className="si-tick__dot" aria-hidden="true" />
              <span className="si-tick__year">{inc.when}</span>
              <span className="si-tick__name">{inc.title}</span>
            </button>
          </li>
        ))}
        <li className={`si-tick${step === CLOSING ? ' si-tick--on' : ''}`}>
          <button type="button" onClick={() => go(CLOSING)} aria-current={step === CLOSING ? 'step' : undefined}>
            <span className="si-tick__dot" aria-hidden="true" />
            <span className="si-tick__year">Now</span>
            <span className="si-tick__name">The data</span>
          </button>
        </li>
      </ol>

      <div className="si-stage" onClick={onStageClick} aria-live="polite">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="si-frame"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.25 } }}
          >
            {step < CLOSING ? <IncidentView incident={INCIDENTS[step]} animate /> : <Closing onDone={finish} animate />}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="si-hint" aria-hidden="true">
        {step < CLOSING ? 'Click, → or Space to continue' : '← to go back'}
      </p>
    </section>
  );
}
