import { useCallback, useEffect, useRef, useState, type MouseEvent } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { dataset } from '../../data/dataset';
import { INCIDENTS, type Incident } from '../../data/incidents';
import { shortName } from '../../data/names';
import './storyIntro.css';

type Props = {
  onDone: () => void;
  /** Milliseconds each step stays before auto-advancing. 0 disables auto-advance. */
  stepMs?: number;
};

const NAMES = new Map(dataset.investigations.map((i) => [i.id, shortName(i)]));
const CLOSING = INCIDENTS.length; // step index of the closing line
const EASE = [0.22, 1, 0.36, 1] as const;

function isTypingTarget(t: EventTarget | null) {
  return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

/** Links in the incident: stem down, rail across, then the investigation chips. */
function Connector({ incident, animate }: { incident: Incident; animate: boolean }) {
  const t = (d: number, dur = 0.5) => (animate ? { delay: d, duration: dur, ease: EASE } : { duration: 0 });
  const n = incident.links.length;
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
      <ul className="si-chips" aria-label={`Investigations linked to ${incident.title}`}>
        {incident.links.map((l, i) => (
          <motion.li
            key={l.id}
            className="si-chip"
            title={l.why}
            initial={{ opacity: animate ? 0 : 1, y: animate ? 6 : 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={t(1.6 + i * 0.09, 0.4)}
          >
            {NAMES.get(l.id) ?? l.id}
          </motion.li>
        ))}
      </ul>
      {incident.scopeNote && <p className="si-scope">{incident.scopeNote}</p>}
    </div>
  );
}

function IncidentView({ incident, animate }: { incident: Incident; animate: boolean }) {
  const t = (d: number) => (animate ? { delay: d, duration: 0.6, ease: EASE } : { duration: 0 });
  const rise = { initial: { opacity: animate ? 0 : 1, y: animate ? 12 : 0 }, animate: { opacity: 1, y: 0 } };
  return (
    <article className="si-incident" aria-labelledby={`si-${incident.id}`}>
      <motion.p className="si-incident__year" {...rise} transition={t(0)}>{incident.year}</motion.p>
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

export function StoryIntro({ onDone, stepMs = 9000 }: Props) {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const rootRef = useRef<HTMLElement>(null);

  const next = useCallback(() => setStep((s) => Math.min(CLOSING, s + 1)), []);
  const prev = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  // Only listen for presenter keys while the intro is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.intersectionRatio > 0.5), { threshold: [0, 0.5, 1] });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduce || !visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || isTypingTarget(e.target)) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); prev(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [reduce, visible, next, prev]);

  // Gentle auto-advance; any manual step restarts the timer. Stops on the closing line.
  useEffect(() => {
    if (reduce || !visible || !stepMs || step >= CLOSING) return;
    const id = window.setTimeout(next, stepMs);
    return () => window.clearTimeout(id);
  }, [reduce, visible, stepMs, step, next]);

  if (reduce) {
    return (
      <section className="si si--static" aria-label="Fires in spaceflight">
        <p className="si-kicker">Fires in spaceflight</p>
        <div className="si-static-list">
          {INCIDENTS.map((inc) => <IncidentView key={inc.id} incident={inc} animate={false} />)}
        </div>
        <Closing onDone={onDone} animate={false} />
      </section>
    );
  }

  const onStageClick = (e: MouseEvent) => {
    if ((e.target as HTMLElement).closest('a, button')) return;
    next();
  };

  return (
    <section ref={rootRef} className="si" aria-label="Fires in spaceflight" aria-roledescription="story">
      <div className="si-top">
        <p className="si-kicker">Fires in spaceflight</p>
        <button type="button" className="si-skip" onClick={onDone}>Skip to missions</button>
      </div>

      <ol className="si-timeline" aria-label="Timeline">
        {INCIDENTS.map((inc, i) => (
          <li key={inc.id} className={`si-tick${i === step ? ' si-tick--on' : ''}${i < step ? ' si-tick--past' : ''}`}>
            <button type="button" onClick={() => setStep(i)} aria-current={i === step ? 'step' : undefined}>
              <span className="si-tick__dot" aria-hidden="true" />
              <span className="si-tick__year">{inc.year}</span>
              <span className="si-tick__name">{inc.title}</span>
            </button>
          </li>
        ))}
        <li className={`si-tick${step === CLOSING ? ' si-tick--on' : ''}`}>
          <button type="button" onClick={() => setStep(CLOSING)} aria-current={step === CLOSING ? 'step' : undefined}>
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
            {step < CLOSING ? <IncidentView incident={INCIDENTS[step]} animate /> : <Closing onDone={onDone} animate />}
          </motion.div>
        </AnimatePresence>
      </div>

      <p className="si-hint" aria-hidden="true">
        {step < CLOSING ? 'Click or press → to continue' : '← to go back'}
      </p>
    </section>
  );
}
