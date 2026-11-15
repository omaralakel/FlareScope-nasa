import { describe, expect, it } from 'vitest';
import {
  ARROW_WIDGET_SELECTOR, STEPS, TEXT_ENTRY_SELECTOR, describeTarget, escapeFocus, keyCommand, nextStep, pickStepInView,
  presenterReducer, prevStep,
} from '../../src/presenter/usePresenter';

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean; repeat: boolean }> = {}) => ({
  key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, ...mods,
});
const body = { kind: 'body' } as const;
const text = { kind: 'text' } as const;
const widget = { kind: 'widget' } as const;
const other = { kind: 'other' } as const;

describe('presenter steps', () => {
  it('has the nine scripted steps in order', () => {
    expect(STEPS).toEqual(['intro', 'mission', 'flame', 'map', 'ranking', 'gravity', 'compare', 'ask', 'earth']);
  });

  it('nextStep clamps at last step', () => {
    expect(nextStep(0, 9)).toBe(1);
    expect(nextStep(7, 9)).toBe(8);
    expect(nextStep(8, 9)).toBe(8);
    expect(nextStep(20, 9)).toBe(8);
  });

  it('prevStep clamps at 0', () => {
    expect(prevStep(3)).toBe(2);
    expect(prevStep(1)).toBe(0);
    expect(prevStep(0)).toBe(0);
    expect(prevStep(-4)).toBe(0);
  });

  it('two rapid next presses advance exactly two steps', () => {
    // Both presses are reduced against the latest value, not a stale render's value.
    let s = 2;
    const presses = [{ type: 'next' } as const, { type: 'next' } as const];
    for (const a of presses) s = presenterReducer(s, a);
    expect(s).toBe(4);
  });

  it('goto clamps into range', () => {
    expect(presenterReducer(0, { type: 'goto', step: 5 })).toBe(5);
    expect(presenterReducer(0, { type: 'goto', step: 42 })).toBe(8);
    expect(presenterReducer(4, { type: 'goto', step: -1 })).toBe(0);
  });
});

describe('keyCommand', () => {
  it('maps navigation keys on the page body', () => {
    expect(keyCommand(key('ArrowRight'), body)).toEqual({ type: 'next' });
    expect(keyCommand(key('PageDown'), body)).toEqual({ type: 'next' });
    expect(keyCommand(key(' '), body)).toEqual({ type: 'next' });
    expect(keyCommand(key('ArrowLeft'), body)).toEqual({ type: 'prev' });
    expect(keyCommand(key('PageUp'), body)).toEqual({ type: 'prev' });
    expect(keyCommand(key('Home'), body)).toEqual({ type: 'goto', step: 0 });
    expect(keyCommand(key('3'), body)).toEqual({ type: 'goto', step: 2 });
    expect(keyCommand(key('9'), body)).toEqual({ type: 'goto', step: 8 });
    expect(keyCommand(key('p'), body)).toEqual({ type: 'toggleIndicator' });
    expect(keyCommand(key('P', { shiftKey: true }), body)).toEqual({ type: 'toggleIndicator' });
    expect(keyCommand(key('Escape'), body)).toEqual({ type: 'escape' });
  });

  it('ignores unhandled keys and 0', () => {
    for (const k of ['0', 'a', 'ArrowDown', 'End']) expect(keyCommand(key(k), body)).toBeNull();
  });

  it('ignores keys with ctrl, meta or alt held', () => {
    expect(keyCommand(key('ArrowRight', { ctrlKey: true }), body)).toBeNull();
    expect(keyCommand(key('ArrowLeft', { metaKey: true }), body)).toBeNull();
    expect(keyCommand(key('1', { altKey: true }), body)).toBeNull();
    expect(keyCommand(key('p', { metaKey: true }), body)).toBeNull();
    expect(keyCommand(key('Escape', { ctrlKey: true }), body)).toBeNull();
  });

  it('ignores auto-repeat for navigation keys', () => {
    for (const k of ['ArrowRight', 'ArrowLeft', 'PageDown', 'PageUp', ' ', 'Home', '4', 'p']) {
      expect(keyCommand(key(k, { repeat: true }), body)).toBeNull();
    }
  });

  it('text-entry targets block every key except Esc', () => {
    for (const k of ['ArrowRight', 'ArrowLeft', ' ', '3', 'p', 'Home', 'PageDown', 'PageUp']) {
      expect(keyCommand(key(k), text)).toBeNull();
    }
    expect(keyCommand(key('Escape'), text)).toEqual({ type: 'escape' });
  });

  it('arrow-owning widgets keep ←/→/Home/End/Space but pass the rest to the presenter', () => {
    for (const k of ['ArrowRight', 'ArrowLeft', 'Home', 'End', ' ']) expect(keyCommand(key(k), widget)).toBeNull();
    expect(keyCommand(key('PageDown'), widget)).toEqual({ type: 'next' });
    expect(keyCommand(key('PageUp'), widget)).toEqual({ type: 'prev' });
    expect(keyCommand(key('5'), widget)).toEqual({ type: 'goto', step: 4 });
    expect(keyCommand(key('p'), widget)).toEqual({ type: 'toggleIndicator' });
    expect(keyCommand(key('Escape'), widget)).toEqual({ type: 'escape' });
  });

  it('on a focused button or link, arrows navigate but Space is left to the browser', () => {
    expect(keyCommand(key(' '), other)).toBeNull();
    expect(keyCommand(key('ArrowRight'), other)).toEqual({ type: 'next' });
    expect(keyCommand(key('Home'), other)).toEqual({ type: 'goto', step: 0 });
  });

  it('shift with arrows or Space is left to the browser', () => {
    expect(keyCommand(key(' ', { shiftKey: true }), body)).toBeNull();
    expect(keyCommand(key('ArrowRight', { shiftKey: true }), body)).toBeNull();
  });
});

/** Minimal stand-in for a DOM element: matches the given selectors (and closest() climbs to itself). */
function fakeEl(matching: string[] = []) {
  const el = { closest: (sel: string) => (matching.includes(sel) ? el : null) };
  return el;
}

describe('describeTarget', () => {
  const doc = { body: fakeEl(), documentElement: fakeEl() };
  it('treats the body, the document and non-elements as the page body', () => {
    expect(describeTarget(doc.body, doc)).toEqual(body);
    expect(describeTarget(doc.documentElement, doc)).toEqual(body);
    expect(describeTarget(null, doc)).toEqual(body);
  });
  it('classifies text entry, arrow widgets and everything else', () => {
    expect(describeTarget(fakeEl([TEXT_ENTRY_SELECTOR]), doc)).toEqual(text);
    expect(describeTarget(fakeEl([ARROW_WIDGET_SELECTOR]), doc)).toEqual(widget);
    expect(describeTarget(fakeEl(), doc)).toEqual(other);
  });
  it('text entry wins over an enclosing arrow widget', () => {
    expect(describeTarget(fakeEl([TEXT_ENTRY_SELECTOR, ARROW_WIDGET_SELECTOR]), doc)).toEqual(text);
  });
  it('selectors: range sliders are arrow widgets, not text; only <summary> (not all of <details>) counts', () => {
    expect(TEXT_ENTRY_SELECTOR).toContain('input:not([type="range"])');
    for (const s of ['[role="radiogroup"]', '[role="application"]', 'input[type="range"]', 'summary']) {
      expect(ARROW_WIDGET_SELECTOR).toContain(s);
    }
    expect(ARROW_WIDGET_SELECTOR).not.toMatch(/details/);
    expect(TEXT_ENTRY_SELECTOR).not.toMatch(/details/);
  });
});

describe('escapeFocus', () => {
  const mk = () => {
    const body = { blur: () => { throw new Error('never blur body'); } };
    return { body, documentElement: {}, activeElement: body as { blur(): void } | null };
  };
  it('blurs any focused element that is not the body', () => {
    const doc = mk();
    let blurred = false;
    doc.activeElement = { blur: () => { blurred = true; } };
    expect(escapeFocus(doc)).toBe(true);
    expect(blurred).toBe(true);
  });
  it('does nothing when the body has focus or nothing does', () => {
    const doc = mk();
    expect(escapeFocus(doc)).toBe(false);
    doc.activeElement = null;
    expect(escapeFocus(doc)).toBe(false);
  });
});

describe('pickStepInView', () => {
  // tops = each section's top edge in viewport px; the reading line sits 300px down.
  const LINE = 300;
  it('picks the last section whose top has passed the reading line', () => {
    expect(pickStepInView([-2000, -900, 120, 900], 0, LINE)).toBe(2);
  });
  it('picks a short section once it reaches the line, even if the next one shows more', () => {
    expect(pickStepInView([-3000, 76, 300, 1200], 3, LINE)).toBe(2);
    expect(pickStepInView([-3000, 76, 310, 1200], 3, LINE)).toBe(1);
  });
  it('enters a side-by-side row at its first section and keeps the current one inside it', () => {
    expect(pickStepInView([-2000, -400, 80, 80, 1500], 1, LINE)).toBe(2);
    expect(pickStepInView([-2000, -400, 80, 80, 1500], 3, LINE)).toBe(3);
  });
  it('returns the last section at the bottom of the page', () => {
    expect(pickStepInView([-3000, -1000, 500], 1, LINE, true)).toBe(2);
  });
  it('falls back to the first section when nothing has reached the line', () => {
    expect(pickStepInView([400, 900], 1, LINE)).toBe(0);
  });
});
