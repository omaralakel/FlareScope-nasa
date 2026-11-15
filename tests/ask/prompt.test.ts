import { describe, expect, it } from 'vitest';
import { buildGroundingContext, buildSystemPrompt } from '../../api/prompt';
import { dataset } from '../../src/data/dataset';

describe('buildSystemPrompt', () => {
  const p = buildSystemPrompt(dataset);

  it('includes every investigation id and the rule to answer only from the data and to say when a question is outside it', () => {
    for (const inv of dataset.investigations) expect(p).toContain(inv.id);
    expect(p).toMatch(/answer only from the (provided )?data/i);
    expect(p).toMatch(/outside the PSI data/i);
    expect(p).toMatch(/do not invent numbers/i);
    expect(p).toMatch(/cite/i);
    expect(p).toMatch(/120 words/);
    expect(p).toMatch(/flammability limit/i);
  });

  it('carries findings with sources, habitat atmospheres and coverage facts, not raw test points', () => {
    const flex = dataset.investigations.find((i) => i.id === 'flex')!;
    expect(p).toContain(flex.findings[0].text);
    expect(p).toContain(flex.findings[0].source);
    expect(p).toContain('Moon base');
    expect(p).toContain('10.2 psi');
    expect(p).toMatch(/Moon base: 8 tests/);
    expect(p).toMatch(/101 usable/);
    expect(p).toMatch(/SAFFIRE-II|Saffire-II/);
    // compact: far smaller than the raw dataset
    expect(p.length).toBeLessThan(JSON.stringify(dataset).length / 5);
  });

  it('is deterministic (cache-friendly)', () => {
    expect(buildSystemPrompt(dataset)).toBe(p);
    expect(buildGroundingContext(dataset)).toBe(buildGroundingContext(dataset));
  });
});
