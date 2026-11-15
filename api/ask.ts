/**
 * POST /api/ask  body { question }  ->  { answer, citations: { investigationId, source }[] }
 *
 * Vercel Node.js function using the Web-standard signature: a named `POST(request: Request)`
 * export returning a `Response`. Vercel serves files in /api as functions for a Vite static
 * site and answers other methods with 405. The key comes from the ANTHROPIC_API_KEY
 * environment variable set in the Vercel project; it is never logged or echoed.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import raw from '../src/data/investigations.json' with { type: 'json' };
import { DatasetSchema, type Dataset } from '../src/data/schema.js';
import { buildSystemPrompt } from './prompt.js';

/** Fast, capable model for live Q&A (latency matters during the presentation). */
export const MODEL = 'claude-sonnet-5-5';
export const SERVER_TIMEOUT_MS = 15_000;
export const MAX_QUESTION = 500;

export const AnswerSchema = z.object({
  answer: z.string(),
  citations: z.array(z.object({ investigationId: z.string(), source: z.string() })),
});
export type Answer = z.infer<typeof AnswerSchema>;

export type CallModel = (system: string, question: string, signal: AbortSignal) => Promise<unknown>;

/** Default model call: structured JSON output, refusal fallback on, no SDK retries (we own the timeout). */
export function anthropicCallModel(apiKey: string): CallModel {
  const client = new Anthropic({ apiKey, timeout: SERVER_TIMEOUT_MS, maxRetries: 0 });
  return async (system, question, signal) => {
    const msg = await client.beta.messages.parse(
      {
        model: MODEL,
        max_tokens: 2048,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low', format: betaZodOutputFormat(AnswerSchema) },
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: question }],
      },
      { signal },
    );
    if (msg.stop_reason === 'refusal') throw new Error('model declined');
    if (!msg.parsed_output) throw new Error(`no structured output (stop_reason ${msg.stop_reason})`);
    return msg.parsed_output;
  };
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

/** Keep only citations whose investigation exists; trim the answer. */
export function sanitizeAnswer(a: Answer, validIds: Set<string>): Answer {
  return {
    answer: a.answer.trim(),
    citations: a.citations
      .filter((c) => validIds.has(c.investigationId) && c.source.trim().length > 0)
      .map((c) => ({ investigationId: c.investigationId, source: c.source.trim() })),
  };
}

function withTimeout<T>(run: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctrl.abort();
      reject(new Error('timeout'));
    }, ms);
  });
  return Promise.race([run(ctrl.signal), timeout]).finally(() => clearTimeout(timer));
}

type Deps = {
  callModel?: CallModel;
  getApiKey?: () => string | undefined;
  dataset?: Dataset;
  timeoutMs?: number;
  /** Requests per minute per client IP; 0 disables. */
  rateLimit?: number;
};

export function createAskHandler(deps: Deps = {}) {
  const getApiKey = deps.getApiKey ?? (() => process.env.ANTHROPIC_API_KEY);
  const timeoutMs = deps.timeoutMs ?? SERVER_TIMEOUT_MS;
  const limit = deps.rateLimit ?? 0;
  let dataset = deps.dataset;
  let system: string | undefined;
  let validIds: Set<string> | undefined;
  const hits = new Map<string, number[]>();

  return async function handle(request: Request): Promise<Response> {
    if (request.method !== 'POST') return json(405, { error: 'Use POST' });

    if (limit > 0) {
      const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
      const now = Date.now();
      const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
      if (recent.length >= limit) return json(429, { error: 'Too many questions, try again in a minute' });
      hits.set(ip, [...recent, now]);
    }

    let question: unknown;
    try {
      question = ((await request.json()) as { question?: unknown } | null)?.question;
    } catch {
      return json(400, { error: 'Body must be JSON: { "question": string }' });
    }
    if (typeof question !== 'string' || question.trim().length < 1 || question.length > MAX_QUESTION) {
      return json(400, { error: `question must be 1 to ${MAX_QUESTION} characters` });
    }

    const apiKey = getApiKey();
    if (!apiKey) return json(502, { error: 'Live answers are not configured' });

    try {
      dataset ??= DatasetSchema.parse(raw);
      system ??= buildSystemPrompt(dataset);
      validIds ??= new Set(dataset.investigations.map((i) => i.id));
      const callModel = deps.callModel ?? anthropicCallModel(apiKey);
      const out = await withTimeout((signal) => callModel(system!, question.trim(), signal), timeoutMs);
      const parsed = AnswerSchema.safeParse(out);
      if (!parsed.success) return json(502, { error: 'The model returned an unexpected answer' });
      return json(200, sanitizeAnswer(parsed.data, validIds));
    } catch (err) {
      const reason = err instanceof Error && err.message === 'timeout' ? 'timed out' : 'failed';
      // Log the error class only, never its message (it can carry request details).
      console.error(`ask: model call ${reason}`, err instanceof Error ? err.name : typeof err);
      return json(502, { error: `Live answer ${reason}` });
    }
  };
}

export const POST = createAskHandler({ rateLimit: 20 });
