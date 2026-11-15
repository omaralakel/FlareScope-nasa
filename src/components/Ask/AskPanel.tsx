import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useReducedMotion } from 'motion/react';
import { dataset } from '../../data/dataset';
import { shortName } from '../../data/names';
import { ask, CACHED_ANSWERS, groupCitations, type AskResult } from './askClient';
import './askPanel.css';

type Props = { onSelectInvestigation?: (id: string) => void };

const byId = new Map(dataset.investigations.map((i) => [i.id, i]));
const MAX = 500;
const WORD_MS = 35;

/**
 * Reveals text word by word (whole text at once with reduced motion). Starts from zero on
 * mount, so callers remount it (via key) for each new answer.
 */
function useTypewriter(text: string, instant: boolean): string {
  const [shown, setShown] = useState(0);
  const parts = text.split(/(\s+)/);
  useEffect(() => {
    if (instant) return;
    const total = text.split(/(\s+)/).length;
    const id = setInterval(() => {
      setShown((n) => {
        if (n + 2 >= total) clearInterval(id);
        return n + 2;
      });
    }, WORD_MS);
    return () => clearInterval(id);
  }, [text, instant]);
  return instant ? text : parts.slice(0, shown).join('');
}

type AnswerProps = { result: AskResult; asked: string; instant: boolean; onSelectInvestigation?: (id: string) => void };

/** One answer; remounted per question so the typewriter starts fresh. */
function Answer({ result, asked, instant, onSelectInvestigation }: AnswerProps) {
  const shown = useTypewriter(result.answer, instant);
  const done = shown.length >= result.answer.length;
  return (
    <article className="ask-answer">
      <header className="ask-answer__head">
        <span className="ask-answer__q">{asked}</span>
        {result.cached && <span className="ask-badge">Cached answer (offline)</span>}
      </header>
      <p className="ask-answer__text" aria-hidden="true">
        {shown}
        {!done && <span className="ask-answer__caret" />}
      </p>
      {done && result.citations.length > 0 && (
        <div className="ask-answer__cites">
          <span className="ask-answer__label">Sources</span>
          <ul>
            {groupCitations(result.citations).map((c) => {
              const inv = byId.get(c.investigationId);
              const sources = c.sources.join(' | ');
              return (
                <li key={c.investigationId}>
                  <button
                    type="button"
                    className="ask-cite"
                    title={sources}
                    onClick={() => onSelectInvestigation?.(c.investigationId)}
                  >
                    {inv ? shortName(inv) : c.investigationId}
                    <span className="sr-only">: {sources}. Opens the investigation card.</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </article>
  );
}

export function AskPanel({ onSelectInvestigation }: Props) {
  const inputId = useId();
  const reduce = useReducedMotion();
  const [question, setQuestion] = useState('');
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ r: AskResult; q: string; id: number } | null>(null);
  const reqRef = useRef(0);

  async function submit(q: string) {
    const text = q.trim();
    if (!text || pending) return;
    const req = ++reqRef.current;
    setQuestion(text);
    setPending(true);
    setResult(null);
    const r = await ask(text.slice(0, MAX));
    if (req !== reqRef.current) return;
    setResult({ r, q: text, id: req });
    setPending(false);
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit(question);
  };

  return (
    <section className="ask" aria-labelledby={`${inputId}-title`}>
      <h2 className="ask__title" id={`${inputId}-title`}>Ask the data</h2>
      <div className="ask__chips" role="group" aria-label="Suggested questions">
        {CACHED_ANSWERS.map((c) => (
          <button key={c.question} type="button" className="ask-chip" onClick={() => void submit(c.question)} disabled={pending}>
            {c.question}
          </button>
        ))}
      </div>
      <form className="ask__form" onSubmit={onSubmit}>
        <label htmlFor={inputId} className="sr-only">Your question</label>
        <input
          id={inputId}
          className="ask__input"
          type="text"
          value={question}
          maxLength={MAX}
          placeholder="Ask about oxygen, pressure, materials, suppression..."
          onChange={(e) => setQuestion(e.currentTarget.value)}
        />
        <button type="submit" className="ask__submit" disabled={pending || !question.trim()}>
          {pending ? 'Asking…' : 'Ask'}
        </button>
      </form>

      {/* Always-mounted live region: screen readers hear status and the full answer once; the visual typewriter is hidden from them. */}
      <p className="sr-only" role="status" aria-live="polite">
        {pending ? 'Looking through the PSI data.' : result ? (result.r.cached ? 'Cached answer. ' : '') + result.r.answer : ''}
      </p>
      <div className="ask__out">
        {pending && <p className="ask__status" aria-hidden="true">Looking through the PSI data…</p>}
        {result && <Answer key={result.id} result={result.r} asked={result.q} instant={!!reduce} onSelectInvestigation={onSelectInvestigation} />}
      </div>
      <p className="ask__note">Answers come only from the PSI data in this app.</p>
    </section>
  );
}
