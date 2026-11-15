import { describe, expect, it } from 'vitest';
import { dataset } from '../../src/data/dataset';
import { INCIDENTS } from '../../src/data/incidents';
import { SAME_DAFT, SPINOFFS } from '../../src/data/spinoffs';

const known = new Set(dataset.investigations.map((i) => i.id));
const items = [...INCIDENTS, ...SPINOFFS, SAME_DAFT];

describe('story and spinoff data', () => {
  it('covers the four incidents and four spinoffs', () => {
    expect(INCIDENTS.map((i) => i.id)).toEqual(['apollo-1', 'apollo-13', 'mir', 'artemis-2']);
    expect(SPINOFFS).toHaveLength(4);
  });

  it.each(items.map((i) => [i.id, i] as const))('%s links only to real investigations', (_id, item) => {
    for (const id of item.linkedInvestigationIds) expect(known.has(id), id).toBe(true);
    expect(item.linkedInvestigationIds).toEqual(item.links.map((l) => l.id));
    for (const l of item.links) expect(l.why.trim().length).toBeGreaterThan(0);
  });

  it.each(items.map((i) => [i.id, i] as const))('%s has an https source', (_id, item) => {
    expect(item.sourceUrl).toMatch(/^https:\/\/\S+$/);
    expect(item.sourceLabel.trim()).not.toBe('');
  });

  it('keeps every incident year in order', () => {
    const years = INCIDENTS.map((i) => i.year);
    expect([...years].sort((a, b) => a - b)).toEqual(years);
  });
});
