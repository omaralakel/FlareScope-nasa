import type { Investigation } from './schema';

/** Short display name: the trailing parenthetical acronym, prefixed with ACME for ACME experiments. */
export function shortName(inv: Pick<Investigation, 'id' | 'name'>): string {
  const m = inv.name.match(/\(([^)]+)\)\s*$/);
  if (!m) return inv.name;
  return inv.id.startsWith('acme-') && !m[1].startsWith('ACME') ? `ACME ${m[1]}` : m[1];
}
