import type { Habitat, HabitatId } from './habitats';
import type { RankedRow } from './rank';
import { explainRank } from './explain';

/** Pre-generated text per investigation (filled by scripts/generate-insights.ts). */
export type Insight = { summary: string; why: Partial<Record<HabitatId, string>> };
export type Insights = Record<string, Insight>;

/** The "why it matters" line: the pre-generated one for this habitat when present, else the data-built explainRank. */
export function whyLine(insights: Insights, r: RankedRow, h: Habitat): string {
  const text = insights[r.inv.id]?.why?.[h.id]?.trim();
  return text ? text : explainRank(r, h);
}
