import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
// @ts-expect-error plain .mjs build script
import { bundleAsk } from '../../scripts/build-api.mjs';

it('api/ask.js is up to date with server/ (run npm run build:api)', async () => {
  const committed = readFileSync(new URL('../../api/ask.js', import.meta.url), 'utf8');
  expect(committed).toBe(await bundleAsk());
}, 30_000);

it('api/ask.js holds no key literal', () => {
  const committed = readFileSync(new URL('../../api/ask.js', import.meta.url), 'utf8');
  expect(committed).not.toMatch(/sk-ant-[A-Za-z0-9_-]{10,}/);
});
