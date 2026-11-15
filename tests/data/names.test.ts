import { describe, expect, it } from 'vitest';
import { shortName } from '../../src/data/names';

describe('shortName', () => {
  it('uses the trailing acronym and prefixes ACME experiments', () => {
    expect(shortName({ id: 'flex', name: 'Flame Extinguishment Experiment (FLEX)' })).toBe('FLEX');
    expect(shortName({ id: 'acme-cfi-g', name: 'ACME Cool Flames Investigation with Gases (CFI-G)' })).toBe('ACME CFI-G');
    expect(shortName({ id: 'acme-flame-design', name: 'ACME Flame Design' })).toBe('ACME Flame Design');
  });
});
