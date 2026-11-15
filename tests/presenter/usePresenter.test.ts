import { describe, expect, it } from 'vitest';
import { STEPS, keyCommand, nextStep, pickStepInView, presenterReducer, prevStep } from '../../src/presenter/usePresenter';

const key = (k: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean }> = {}) => ({
  key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods,
});
const body = { interactive: false, isBody: true };

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
  it('maps navigation keys', () => {
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
    expect(keyCommand(key('Escape'), body)).toEqual({ type: 'hideIndicator' });
  });

  it('ignores unhandled keys and 0', () => {
    expect(keyCommand(key('0'), body)).toBeNull();
    expect(keyCommand(key('a'), body)).toBeNull();
    expect(keyCommand(key('ArrowDown'), body)).toBeNull();
  });

  it('ignores keys with ctrl, meta or alt held', () => {
    expect(keyCommand(key('ArrowRight', { ctrlKey: true }), body)).toBeNull();
    expect(keyCommand(key('ArrowLeft', { metaKey: true }), body)).toBeNull();
    expect(keyCommand(key('1', { altKey: true }), body)).toBeNull();
    expect(keyCommand(key('p', { metaKey: true }), body)).toBeNull();
  });

  it('never hijacks keys from interactive targets', () => {
    const field = { interactive: true, isBody: false };
    for (const k of ['ArrowRight', 'ArrowLeft', ' ', '3', 'p', 'Home', 'PageDown', 'Escape']) {
      expect(keyCommand(key(k), field)).toBeNull();
    }
  });

  it('Space only acts on the page body, not on a focused button or link', () => {
    const button = { interactive: false, isBody: false };
    expect(keyCommand(key(' '), button)).toBeNull();
    expect(keyCommand(key('ArrowRight'), button)).toEqual({ type: 'next' });
  });

  it('shift with arrows or Space is left to the browser', () => {
    expect(keyCommand(key(' ', { shiftKey: true }), body)).toBeNull();
    expect(keyCommand(key('ArrowRight', { shiftKey: true }), body)).toBeNull();
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
