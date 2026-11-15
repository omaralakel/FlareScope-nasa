/**
 * Pre-generates src/data/insights.json: for each investigation, a 2-sentence plain summary and
 * a one-line "why it matters" per habitat, written by Claude from that investigation's JSON only
 * (plus the fixed habitat atmospheres the "why" lines refer to).
 *
 *   ANTHROPIC_API_KEY=... npx tsx scripts/generate-insights.ts
 *
 * Re-running overwrites insights.json. Investigations that fail are skipped (the app falls back
 * to the data-built explainRank line for them) and listed at the end.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { dataset } from '../src/data/dataset.js';
import { HABITATS, type HabitatId } from '../src/model/habitats.js';
import type { Insights } from '../src/model/insights.js';

/** Offline, quality-first batch job: the current default Opus model. */
const MODEL = 'claude-opus-5-5';
const OUT = fileURLToPath(new URL('../src/data/insights.json', import.meta.url));
const HABITAT_IDS = Object.keys(HABITATS) as HabitatId[];

const InsightSchema = z.object({
  summary: z.string(),
  why: z.object({ iss: z.string(), moon: z.string(), rover: z.string(), mars: z.string(), suit: z.string() }),
});

const SYSTEM = [
  'You write short, plain text for FlameScope, a NASA spacecraft fire-safety app for a general audience.',
  'Use ONLY the investigation JSON and habitat list you are given. Do not add facts, numbers or names that are not in them.',
  'summary: exactly 2 short sentences on what the investigation did and found.',
  'why: for each habitat id, one sentence (at most 25 words) on why this investigation matters for that habitat, comparing its tested oxygen and pressure with the habitat when the data has them. If the data has no oxygen or pressure, say what it does offer instead.',
  'Never state a flammability limit the data does not contain. No dashes used as punctuation, no markdown.',
].join('\n');

const habitatText = Object.values(HABITATS)
  .map((h) => `${h.id}: ${h.label}, ${h.o2Percent}% O2 at ${h.pressurePsi} psi, ${h.gravityG} g${h.assumed ? ' (assumed)' : ''}`)
  .join('\n');

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      'ANTHROPIC_API_KEY is not set.\nRun: ANTHROPIC_API_KEY=your-key npx tsx scripts/generate-insights.ts\n' +
        'insights.json was not changed; the app keeps using its data-built "why" lines.',
    );
    process.exit(1);
  }
  const client = new Anthropic();
  const out: Insights = {};
  const failed: string[] = [];

  for (const inv of dataset.investigations) {
    process.stdout.write(`${inv.id} ... `);
    try {
      const msg = await client.beta.messages.parse({
        model: MODEL,
        max_tokens: 4096,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'medium', format: betaZodOutputFormat(InsightSchema) },
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: `Habitats:\n${habitatText}\n\nInvestigation JSON:\n${JSON.stringify(inv, null, 2)}`,
          },
        ],
      });
      if (msg.stop_reason === 'refusal' || !msg.parsed_output) throw new Error(`no output (stop_reason ${msg.stop_reason})`);
      const p = msg.parsed_output;
      out[inv.id] = {
        summary: p.summary.trim(),
        why: Object.fromEntries(HABITAT_IDS.map((h) => [h, p.why[h].trim()])),
      };
      console.log('ok');
    } catch (err) {
      failed.push(inv.id);
      console.log(`failed (${err instanceof Error ? err.name : 'error'})`);
    }
  }

  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${Object.keys(out).length} of ${dataset.investigations.length} insights to ${OUT}.`);
  if (failed.length) console.log(`Skipped: ${failed.join(', ')}. Re-run to retry.`);
}

main();
