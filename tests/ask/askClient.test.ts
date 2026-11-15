import { afterEach, describe, expect, it, vi } from 'vitest';
import { ask, bestCachedAnswer, CACHED_ANSWERS } from '../../src/components/Ask/askClient';
import { dataset } from '../../src/data/dataset';

const ok = (body: unknown) =>
  Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));

afterEach(() => {
  vi.useRealTimers();
});

describe('askClient', () => {
  it('returns a cached answer with cached=true when fetch rejects', async () => {
    const fetchFn = vi.fn(() => Promise.reject(new TypeError('offline'))) as unknown as typeof fetch;
    const r = await ask('Which experiments tested fire suppression?', fetchFn);
    expect(r.cached).toBe(true);
    expect(r.answer).toBe(CACHED_ANSWERS[1].answer);
    expect(r.citations.length).toBeGreaterThan(0);
  });

  it('returns cached=true when the response is not ok', async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ error: 'bad gateway' }), { status: 502 })),
    ) as unknown as typeof fetch;
    const r = await ask('What does the data say about 30% oxygen?', fetchFn);
    expect(r.cached).toBe(true);
    expect(r.answer).toBe(CACHED_ANSWERS[0].answer);
  });

  it('returns cached=true when the body is not valid JSON or has the wrong shape', async () => {
    const html = vi.fn(() => Promise.resolve(new Response('<!doctype html>', { status: 200 }))) as unknown as typeof fetch;
    expect((await ask('How many tests are near Moon base conditions?', html)).cached).toBe(true);
    const wrong = vi.fn(() => ok({ text: 'hi' })) as unknown as typeof fetch;
    expect((await ask('How many tests are near Moon base conditions?', wrong)).cached).toBe(true);
  });

  it('times out after 15 s and falls back', async () => {
    vi.useFakeTimers();
    let aborted = false;
    const fetchFn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted = true;
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    ) as unknown as typeof fetch;
    const p = ask('Can I see a flammability limit for the Moon base?', fetchFn);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const r = await p;
    expect(aborted).toBe(true);
    expect(r.cached).toBe(true);
    expect(r.answer).toBe(CACHED_ANSWERS[5].answer);
  });

  it('returns the live answer with cached=false and drops unknown citation ids', async () => {
    const fetchFn = vi.fn(() =>
      ok({
        answer: 'FLEX tested droplets.',
        citations: [
          { investigationId: 'flex', source: 'PSI-69 record' },
          { investigationId: 'made-up', source: 'nowhere' },
        ],
      }),
    ) as unknown as typeof fetch;
    const r = await ask('What did FLEX do?', fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('/api/ask', expect.objectContaining({ method: 'POST' }));
    expect(r).toEqual({
      answer: 'FLEX tested droplets.',
      citations: [{ investigationId: 'flex', source: 'PSI-69 record' }],
      cached: false,
    });
  });

  it('points to the closest cached answer when nothing matches well', async () => {
    const fetchFn = vi.fn(() => Promise.reject(new Error('offline'))) as unknown as typeof fetch;
    const r = await ask('Tell me about rover wheels and batteries', fetchFn);
    expect(r.cached).toBe(true);
    expect(r.answer).toMatch(/^Live answers are offline; here is what the data shows about/);
    expect(r.answer).toContain(CACHED_ANSWERS[4].answer);
  });
});

describe('bestCachedAnswer', () => {
  it('matches paraphrases by normalized word overlap', () => {
    expect(bestCachedAnswer('which experiments tested suppression').entry).toBe(CACHED_ANSWERS[1]);
    expect(bestCachedAnswer('What does the data say about 30% O2?').entry).toBe(CACHED_ANSWERS[0]);
    expect(bestCachedAnswer('  WHAT does the data say about 30% oxygen  ').exact).toBe(true);
  });
});

describe('cachedAnswers.json', () => {
  const ids = new Set(dataset.investigations.map((i) => i.id));
  it('has 6 demo questions', () => {
    expect(CACHED_ANSWERS).toHaveLength(6);
  });
  it.each(CACHED_ANSWERS.map((c) => [c.question, c] as const))('%s: real citations, at most 120 words', (_q, c) => {
    expect(c.citations.length).toBeGreaterThan(0);
    for (const cit of c.citations) {
      expect(ids.has(cit.investigationId), cit.investigationId).toBe(true);
      expect(cit.source.length).toBeGreaterThan(0);
    }
    expect(c.answer.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(120);
    expect(c.answer).not.toMatch(/--|—/);
  });
});
