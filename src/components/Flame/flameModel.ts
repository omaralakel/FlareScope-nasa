// CPU-side helpers for the Live Flame. Qualitative cues only, not a combustion model.

export type FlameInputs = { o2: number; pressure: number; flow: number; gravity: number };

/** Ease time constant (s). exp smoothing with tau 0.1 s reaches ~95% in 300 ms. */
export const EASE_TAU_S = 0.1;

/** Turbulence phase speed: buoyant flicker scales with sqrt(g); forced flow adds a little. */
export function phaseSpeed(gravity: number, flow: number): number {
  const gs = Math.sqrt(Math.min(Math.max(gravity, 0), 1.2));
  const fn = Math.min(Math.max(flow / 50, 0), 1);
  return 0.08 + 0.9 * gs + 0.25 * fn;
}

/** Exponential ease of `current` toward `target` over `dt` seconds. */
export function ease(current: number, target: number, dt: number, tau = EASE_TAU_S): number {
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

export type FlameRegime = 'weak' | 'buoyant' | 'partial' | 'forced' | 'spherical';

export function flameRegime({ o2, flow, gravity }: FlameInputs): FlameRegime {
  if (o2 < 15) return 'weak';
  if (gravity >= 0.6) return 'buoyant';
  if (gravity >= 0.1) return 'partial';
  if (flow >= 5) return 'forced';
  return 'spherical';
}

export const REGIME_LABEL: Record<FlameRegime, string> = {
  weak: 'Weakening: low O2, flickering toward extinction',
  buoyant: 'Buoyant teardrop: hot gas rises, sooty yellow glow',
  partial: 'Partial gravity: shorter, slower plume',
  forced: 'No buoyancy: airflow drags the flame downstream',
  spherical: 'No buoyancy: steady blue diffusion sphere',
};
