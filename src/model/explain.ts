import type { Habitat } from './habitats';
import type { RankedRow } from './rank';

const num = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1));

/** A short factual sentence on why an investigation ranks where it does for a habitat. Built only from data. */
export function explainRank(r: RankedRow, h: Habitat): string {
  const { inv } = r;
  const parts: string[] = [];
  const o2 = inv.o2Percent.value;
  const target = num(h.o2Percent);

  if (!o2) {
    parts.push('No oxygen range reported');
  } else if (h.o2Percent >= o2.min && h.o2Percent <= o2.max) {
    parts.push(`Tested ${num(o2.min)}–${num(o2.max)}% O₂, covers the ${h.label}'s ${target}%`);
  } else {
    const below = h.o2Percent > o2.max; // habitat is above the tested range
    const gap = below ? h.o2Percent - o2.max : o2.min - h.o2Percent;
    const dir = below ? 'below' : 'above';
    const pts = `${num(gap)} point${gap === 1 ? '' : 's'} ${dir}`;
    const tested =
      o2.min === o2.max ? `Tested only near ${num(o2.min)}% O₂` : `Tested ${num(o2.min)}–${num(o2.max)}% O₂`;
    parts.push(`${tested}, ${pts} the ${h.label}'s ${target}%`);
  }

  const psi = inv.pressurePsi.value;
  if (psi) parts.push(`tested ${num(psi.min)}\u2013${num(psi.max)} psi`);
  if (inv.pillars.length > 0) parts.push(`covers ${inv.pillars.join(', ')}`);
  parts.push(`${inv.fuelPhase} fuel`);
  return parts.join('; ') + '.';
}
