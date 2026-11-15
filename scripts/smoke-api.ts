/**
 * Local smoke test of the /api/ask handler logic. No network, no real API call:
 * it runs with ANTHROPIC_API_KEY unset and only checks the error paths.
 * Run: npm run smoke:api
 */
import assert from 'node:assert/strict';

delete process.env.ANTHROPIC_API_KEY;
const { POST } = await import('../api/ask.ts');

const call = (init: RequestInit) => POST(new Request('http://localhost/api/ask', init));
const post = (body: unknown) =>
  call({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

const noKey = await post({ question: 'Which experiments tested suppression?' });
assert.equal(noKey.status, 502);
assert.match(noKey.headers.get('content-type') ?? '', /application\/json/);
assert.equal(typeof ((await noKey.json()) as { error: unknown }).error, 'string');
console.log('ok 502 JSON error when no ANTHROPIC_API_KEY');

const empty = await post({ question: '   ' });
assert.equal(empty.status, 400);
assert.equal(typeof ((await empty.json()) as { error: unknown }).error, 'string');
console.log('ok 400 for empty question');

const badJson = await call({ method: 'POST', body: 'not json' });
assert.equal(badJson.status, 400);
console.log('ok 400 for invalid JSON');

const get = await call({ method: 'GET' });
assert.equal(get.status, 405);
console.log('ok 405 for GET');

console.log('smoke:api passed');
