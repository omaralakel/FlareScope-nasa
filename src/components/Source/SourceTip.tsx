import { useId, useState, type ReactNode } from 'react';
import type { Confidence } from '../../data/schema';
import './sourceTip.css';

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  stated: 'Stated in source',
  derived: 'Derived from source',
  missing: 'Not reported',
};

const URL_RE = /(https?:\/\/[^\s;,)]+)/g;

/** Renders a source string, turning any URLs inside it into links. */
export function SourceText({ source }: { source: string | null }) {
  if (!source) return <span className="st-source__none">No source reported</span>;
  const parts = source.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a key={i} href={part} target="_blank" rel="noreferrer">
            {part.replace(/^https?:\/\//, '')}
          </a>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

export type SourceTipCardProps = {
  source: string | null;
  confidence: Confidence;
  title?: ReactNode;
  children?: ReactNode;
  /** Short line explaining how the value relates to the source (e.g. unit conversion). */
  note?: ReactNode;
  id?: string;
  className?: string;
};

/** The tooltip panel itself: optional title and values, then the source and its confidence. */
export function SourceTipCard({ source, confidence, title, children, note, id, className }: SourceTipCardProps) {
  return (
    <div id={id} role="tooltip" className={`st-card${className ? ` ${className}` : ''}`}>
      {title && <div className="st-card__title">{title}</div>}
      {children && <div className="st-card__body">{children}</div>}
      <div className="st-card__foot">
        <span className={`st-conf st-conf--${confidence}`}>{CONFIDENCE_LABEL[confidence]}</span>
        {note && <span className="st-note">{note}</span>}
        <span className="st-source">
          <SourceText source={source} />
        </span>
      </div>
    </div>
  );
}

export type SourceTipProps = {
  source: string | null;
  confidence: Confidence;
  /** Extra content shown in the tooltip above the source line. */
  detail?: ReactNode;
  title?: ReactNode;
  children: ReactNode;
};

/**
 * Wraps inline content; hovering or focusing it (Tab) shows where the value came from.
 * Escape closes it.
 */
export function SourceTip({ source, confidence, detail, title, children }: SourceTipProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span
      className="st-anchor"
      tabIndex={0}
      aria-describedby={open ? id : undefined}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') setOpen(false);
      }}
    >
      {children}
      {open && (
        <SourceTipCard id={id} className="st-card--floating" source={source} confidence={confidence} title={title}>
          {detail}
        </SourceTipCard>
      )}
    </span>
  );
}

export default SourceTip;
