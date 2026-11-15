import { describe, expect, it } from 'vitest';
import { ease, flameRegime, phaseSpeed } from '../../src/components/Flame/flameModel';

describe('flame model helpers', () => {
  it('eases ~95% of the way in 300 ms without overshoot', () => {
    let v = 0;
    for (let i = 0; i < 18; i++) v = ease(v, 1, 1 / 60);
    expect(v).toBeGreaterThan(0.94);
    expect(v).toBeLessThanOrEqual(1);
  });

  it('flickers faster with gravity and stays near-steady at 0 g, no flow', () => {
    expect(phaseSpeed(1, 0)).toBeGreaterThan(phaseSpeed(0.166, 0));
    expect(phaseSpeed(0, 0)).toBeLessThan(0.1);
  });

  it('classifies regimes', () => {
    expect(flameRegime({ o2: 21, pressure: 14.7, flow: 0, gravity: 1 })).toBe('buoyant');
    expect(flameRegime({ o2: 21, pressure: 14.7, flow: 0, gravity: 0 })).toBe('spherical');
    expect(flameRegime({ o2: 21, pressure: 14.7, flow: 10, gravity: 0 })).toBe('forced');
    expect(flameRegime({ o2: 30, pressure: 10.2, flow: 0, gravity: 0.166 })).toBe('partial');
    expect(flameRegime({ o2: 12, pressure: 14.7, flow: 0, gravity: 1 })).toBe('weak');
  });
});
