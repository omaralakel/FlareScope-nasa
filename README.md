# FlameScope

FlameScope turns NASA's microgravity fire-safety experiments into a guided dashboard: pick a mission habitat, see which experiments actually tested its conditions, and ask grounded questions about the data. Built for NASA Space Apps 2026 by team **Buffet Conquerers**.

## Run locally

```
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # type-check + production build into dist/
npm run preview    # serve the production build
npm run build:api  # rebuild api/ask.js from server/ (commit the result)
npm run smoke:api  # smoke test of the built api/ask.js (no network, no key)
```

Needs Node 20.10 or newer (`package.json` sets `engines.node` to `>=20.10`).

The Ask function is written in `server/ask.ts` and `server/prompt.ts`, and `npm run build:api` bundles it into one self-contained file, `api/ask.js`, which is committed and is what Vercel deploys (so Vercel never has to compile TypeScript). After changing anything in `server/` or the data it reads, run `npm run build:api` and commit `api/ask.js`; a test fails if it is stale.

## Data

All data is bundled into the app (`src/data/investigations.json`); the page makes no runtime data requests.

- Source: NASA Physical Sciences Informatics (PSI) public API, downloaded into `data-raw/psi/` (`data-raw/fetch_psi.py`).
- `scripts/build-dataset.ts` merges the PSI records with hand-written text in `scripts/curated/` and writes `src/data/investigations.json`.
- Rebuild: `npx tsx scripts/build-dataset.ts` (a test checks the checked-in JSON equals a fresh build).
- Details and field mapping: `docs/data-sources.md`. The challenge text: `docs/challenge-brief.md`.
- Provenance rule: every value in the app traces to a PSI record or table row and carries its source and a confidence flag. Anything the PSI records do not state is shown as "not reported", never guessed.

## AI (Claude)

Live Ask calls Claude from one Vercel function, `api/ask.js` (built from `server/ask.ts`). It needs `ANTHROPIC_API_KEY`:

- On Vercel: set it ONLY in the project's Settings, Environment Variables.
- For `vercel dev` locally: put it in `.env.local` (git-ignored).
- Never commit it and never paste it in chat or a screenshot.

Without a key (or offline, or on timeout) the app answers from cached answers and labels them "Cached answer (offline)".

Optional: pre-generate the per-investigation insights with
`ANTHROPIC_API_KEY=... npx tsx scripts/generate-insights.ts`, which fills `src/data/insights.json`; then commit that JSON.

## Deploy to Vercel (the team does this)

1. Import the repo in Vercel, or run `npx vercel` in this folder. Framework: Vite. `vercel.json` already sets build `npm run build` and output `dist`; `api/ask.js` is deployed as a function automatically (max duration 15 s).
2. Add `ANTHROPIC_API_KEY` under Settings, Environment Variables (Production), then deploy.
3. Pre-demo check:
   ```
   curl -X POST https://<deploy>/api/ask -H 'content-type: application/json' -d '{"question":"Which experiments tested suppression?"}'
   ```
   Expect JSON with `answer` and `citations`. A JSON `{"error": ...}` with status 502 means the key is missing or the call failed; the app will still work from cached answers. If the curl fails, open Vercel, Project, Logs for the function error.
4. Offline test: open the deployed page, turn Wi-Fi off, walk the whole demo. Everything except live Ask should work, and Ask shows "Cached answer (offline)".  Fonts are bundled, so nothing external is needed.

## Presenter keys

| Key | Action |
|---|---|
| Right arrow, Space, PageDown | Next step (Space only when nothing is focused) |
| Left arrow, PageUp | Previous step |
| 1 to 9 | Jump to step |
| Home | Back to the intro |
| P | Show or hide the step indicator |
| Esc | Release focus from a field or widget so the arrows drive the demo again |

Text fields (the Ask box) keep all keys until Esc. The map, sliders and mission picker keep only left/right arrows, Home, End and Space for themselves; PageUp/PageDown, 1 to 9 and P still drive the demo. Esc always hands the keys back.

## Demo script (9 steps, one point each)

1. **Intro**: Real spaceflight fires (Apollo 1, Apollo 13, Mir) happened, and the experiments that study them are buried in PSI tables nobody can browse by mission.
2. **Mission**: Pick the Moon base: 30% O2 at 10.2 psi, lunar gravity (0.166 g), not ISS air.
3. **Flame**: In 0 g the flame is a sphere; at 1 g it is a teardrop pulled up by buoyancy. This is qualitative, a visual of the physics, not a measurement.
4. **Condition map**: "Near" means within 3 points of O2 and 1.5 psi: 223 tests sit near ISS cabin air, only 8 near the Moon base atmosphere, and 0 at spacesuit conditions (100% O2 at 4.3 psi). We do not draw a flammability boundary: of 101 usable burn / no-burn tests (57 burned, 44 did not), only two investigations contribute, and whether a flame lit depended on fuel, flow and geometry, not just O2 and pressure, so a boundary from pooled data would mislead.
5. **Ranking**: For the Moon base the top experiments are ACME BRE, FLEX, FLEX-2, then BASS-II and Saffire-II; the score is transparent (Conditions, Safety pillars, Material, i.e. fuel phase) and the weights are adjustable.
6. **Gravity bridge**: What did not burn in orbit burned at 1 g: 2 of 4 silicone samples in Saffire-II (2-1 and 2-4). The Moon and Mars lie between 0 and 1 g, and PSI has no results there.
7. **Compare**: FLEX versus BASS-II side by side: what is the same, what differs, and what each did not report.
8. **Ask**: Answers are grounded in the dataset with citations to PSI rows, and it refuses out-of-scope questions; offline it falls back to cached answers.
9. **Back on Earth**: The same research became spinoffs: firefighters' air tanks, a smoke detector that tells smoke from dust, fire attire, water-mist extinguishers.

## Credits

- Data: NASA Physical Sciences Informatics (PSI), https://psi.nasa.gov. The PSI records we checked state license CC0 1.0 (Creative Commons Zero).
- Challenge brief: NASA Space Apps 2026 (`docs/challenge-brief.md`).
- Built with Claude (Anthropic).
