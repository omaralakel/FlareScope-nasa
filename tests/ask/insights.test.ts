import { describe, expect, it } from 'vitest';
import { dataset } from '../../src/data/dataset';
import { explainRank } from '../../src/model/explain';
import { HABITATS } from '../../src/model/habitats';
import { whyLine, type Insights } from '../../src/model/insights';
import { rankInvestigations } from '../../src/model/rank';

const row = rankInvestigations(dataset.investigations, HABITATS.moon).find((r) => r.inv.id === 'flex')!;

describe('whyLine', () => {
  it('prefers the pre-generated why for the habitat', () => {
    const ins: Insights = { flex: { summary: 's', why: { moon: 'Generated why for the Moon.' } } };
    expect(whyLine(ins, row, HABITATS.moon)).toBe('Generated why for the Moon.');
  });
  it('falls back to explainRank when the investigation, habitat or text is missing', () => {
    const fallback = explainRank(row, HABITATS.moon);
    expect(whyLine({}, row, HABITATS.moon)).toBe(fallback);
    expect(whyLine({ flex: { summary: 's', why: { iss: 'x' } } }, row, HABITATS.moon)).toBe(fallback);
    expect(whyLine({ flex: { summary: 's', why: { moon: '  ' } } }, row, HABITATS.moon)).toBe(fallback);
  });
});
