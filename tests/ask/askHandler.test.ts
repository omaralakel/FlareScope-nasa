import { describe, expect, it, vi } from 'vitest';
import { createAskHandler, MODEL, SERVER_TIMEOUT_MS } from '../../server/ask';
import { ASK_TIMEOUT_MS } from '../../src/components/Ask/askClient';

const post = (body: unknown, method = 'POST') =>
  new Request('http://localhost/api/ask', {
    method,
    headers: { 'content-type': 'application/json' },
    body: method === 'GET' ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });

const KEY = 'sk-test-not-real-123';

describe('api/ask handler', () => {
  it('uses a current Sonnet model id', () => {
    expect(MODEL).toBe('claude-sonnet-5-5');
  });

  it('rejects non-POST with 405', async () => {
    const h = createAskHandler({ getApiKey: () => KEY, callModel: vi.fn() });
    expect((await h(post(null, 'GET'))).status).toBe(405);
  });

  it.each([
    ['empty', { question: '' }],
    ['blank', { question: '   ' }],
    ['too long', { question: 'x'.repeat(501) }],
    ['missing', {}],
    ['not a string', { question: 42 }],
    ['bad json', '{nope'],
  ])('returns 400 for %s question', async (_n, body) => {
    const callModel = vi.fn();
    const h = createAskHandler({ getApiKey: () => KEY, callModel });
    const res = await h(post(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toHaveProperty('error');
    expect(callModel).not.toHaveBeenCalled();
  });

  it('returns the answer and drops citations whose id is not in the dataset', async () => {
    const callModel = vi.fn(async () => ({
      answer: '  FLEX burned droplets.  ',
      citations: [
        { investigationId: 'flex', source: 'PSI-69 record: objective' },
        { investigationId: 'warp-drive', source: 'invented' },
      ],
    }));
    const h = createAskHandler({ getApiKey: () => KEY, callModel });
    const res = await h(post({ question: 'What did FLEX test?' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      answer: 'FLEX burned droplets.',
      citations: [{ investigationId: 'flex', source: 'PSI-69 record: objective' }],
    });
    const [system, question] = callModel.mock.calls[0] as unknown as [string, string];
    expect(system).toContain('bass-ii');
    expect(question).toBe('What did FLEX test?');
  });

  it('returns 502 with JSON error when the key is missing, without calling the model', async () => {
    const callModel = vi.fn();
    const h = createAskHandler({ getApiKey: () => undefined, callModel });
    const res = await h(post({ question: 'hi' }));
    expect(res.status).toBe(502);
    expect(await res.json()).toHaveProperty('error');
    expect(callModel).not.toHaveBeenCalled();
  });

  it('returns 502 and never echoes the key when the model call fails', async () => {
    const h = createAskHandler({
      getApiKey: () => KEY,
      callModel: async () => {
        throw new Error(`401 invalid x-api-key ${KEY}`);
      },
    });
    const res = await h(post({ question: 'hi' }));
    expect(res.status).toBe(502);
    const text = await res.text();
    expect(text).not.toContain(KEY);
    expect(JSON.parse(text)).toHaveProperty('error');
  });

  it('returns 502 when the model output has the wrong shape', async () => {
    const h = createAskHandler({ getApiKey: () => KEY, callModel: async () => ({ answer: 3 }) });
    expect((await h(post({ question: 'hi' }))).status).toBe(502);
  });

  it('server timeout is shorter than the client timeout so the 502 arrives first', () => {
    expect(SERVER_TIMEOUT_MS).toBeLessThanOrEqual(ASK_TIMEOUT_MS - 1_000);
  });

  it('rate limits per IP and lets the window expire', async () => {
    vi.useFakeTimers();
    try {
      const h = createAskHandler({ getApiKey: () => KEY, callModel: async () => ({ answer: 'ok', citations: [] }), rateLimit: 2 });
      const req = () => {
        const r = post({ question: 'q' });
        r.headers.set('x-forwarded-for', '1.2.3.4');
        return h(r);
      };
      expect((await req()).status).toBe(200);
      expect((await req()).status).toBe(200);
      expect((await req()).status).toBe(429);
      await vi.advanceTimersByTimeAsync(60_000);
      expect((await req()).status).toBe(200);
    } finally {
      vi.useRealTimers();
    }
  });

  it('times out after the server timeout and returns 502', async () => {
    vi.useFakeTimers();
    try {
      let signal: AbortSignal | undefined;
      const h = createAskHandler({
        getApiKey: () => KEY,
        callModel: (_s, _q, sig) => {
          signal = sig;
          return new Promise(() => {});
        },
      });
      const p = h(post({ question: 'slow?' }));
      await vi.advanceTimersByTimeAsync(SERVER_TIMEOUT_MS - 1);
      expect(signal?.aborted).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const res = await p;
      expect(res.status).toBe(502);
      expect(signal?.aborted).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});
