import { describe, expect, it } from 'vitest';
import { initialState, reducer } from '../../src/state/store';

describe('store reducer', () => {
  it('starts on the ISS habitat with default flow', () => {
    expect(initialState.habitat).toBe('iss');
    expect(initialState.o2).toBe(21);
    expect(initialState.pressure).toBe(14.7);
    expect(initialState.gravity).toBe(0);
    expect(initialState.flow).toBe(10);
    expect(initialState.compare).toEqual([null, null]);
  });

  it('setHabitat sets o2, pressure and gravity from the habitat and keeps flow', () => {
    const start = reducer(initialState, { type: 'setCondition', partial: { flow: 33 } });
    const s = reducer(start, { type: 'setHabitat', id: 'moon' });
    expect(s.habitat).toBe('moon');
    expect(s.o2).toBe(30);
    expect(s.pressure).toBe(10.2);
    expect(s.gravity).toBe(0.166);
    expect(s.flow).toBe(33);
  });

  it('setCondition merges partially', () => {
    const s = reducer(initialState, { type: 'setCondition', partial: { o2: 40 } });
    expect(s.o2).toBe(40);
    expect(s.pressure).toBe(initialState.pressure);
    expect(s.gravity).toBe(initialState.gravity);
    expect(s.flow).toBe(initialState.flow);
    expect(s.habitat).toBe('iss');
    const t = reducer(s, { type: 'setCondition', partial: { gravity: 1, flow: 0 } });
    expect(t).toMatchObject({ o2: 40, gravity: 1, flow: 0 });
  });

  it('setStep sets the step', () => {
    expect(reducer(initialState, { type: 'setStep', step: 3 }).step).toBe(3);
  });

  it('setCompare sets both slots', () => {
    const s = reducer(initialState, { type: 'setCompare', a: 'inv-a', b: null });
    expect(s.compare).toEqual(['inv-a', null]);
    expect(reducer(s, { type: 'setCompare', a: 'x', b: 'y' }).compare).toEqual(['x', 'y']);
  });

  it('does not mutate the previous state', () => {
    const before = { ...initialState };
    reducer(initialState, { type: 'setHabitat', id: 'suit' });
    expect(initialState).toEqual(before);
  });
});
