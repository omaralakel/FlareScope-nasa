# FlameScope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An interactive, AI-assisted web dashboard that turns NASA PSI microgravity combustion data into fire-safety insights for crewed habitats, ready for a live presentation.

**Architecture:** A Vite + React + TypeScript single-page app reading one curated, source-cited JSON dataset. Pure TypeScript modules hold the logic (flammability model, ranking, habitats) and are unit-tested. The visual layer is a WebGL flame, D3 condition map and Motion animations. Claude text is pre-generated into JSON at build time; one Vercel serverless function handles optional live Q&A.

**Tech Stack:** Vite 5, React 18, TypeScript 5, Vitest, D3 7, Motion (framer-motion 11), Zod 3, raw WebGL (no three.js), `@anthropic-ai/sdk`, Vercel.

**Spec:** `docs/specs/2026-11-15-flamescope-design.md`

## Global Constraints

- Team name shown in the app: **Buffet Conquerers**. App name: **FlameScope**. Logo: a placeholder SVG flame mark in `src/assets/logo.svg`, swappable.
- Every numeric value in `investigations.json` carries `source` and `confidence` ∈ `stated | derived | missing`. `missing` values are `null`, never guessed.
- Habitat atmospheres (from the challenge text): Earth/ISS 21% O2 at 14.7 psi; Moon base and pressurized rover ≥30% O2 at ≤10.2 psi (use 30% / 10.2 psi as the point); spacesuit 100% O2 at 4.3 psi. Mars habitat: same as Moon base, labeled "assumed, not specified by NASA".
- Gravity presets: 0g, Moon 0.166g, Mars 0.38g, Earth 1g.
- The whole app works with no network and no API key, except live Q&A, which falls back to cached answers.
- Dark theme, projector-friendly; target 1920×1080 and 1440×900 laptop screens.
- API key only in the `ANTHROPIC_API_KEY` env var, never in client code or chat.
- Out of scope: raw PSI file ingestion, accounts, rocket/propellant combustion.
- No git commits unless the team asks; each task ends with a checkpoint (tests pass, app runs).

## Review Focus

1. **Missing data in a field the UI expects** (for example an investigation with no pressure value): the map skips the point and the card shows "not reported", no crash, no `NaN`. Test in Task 2 and Task 7.
2. **Too few burn/no-burn points to fit the model** (fewer than 6, or all one outcome): `fitLogistic` returns `null` and the map shows the "sketched from published limits" fallback label. Test in Task 4.
3. **Live Q&A with no key, no network or an API error**: the Ask panel returns a cached answer and says so, never a spinner forever. Test in Task 12.
4. **Questions outside the dataset** ("how do rocket engines burn?"): the answer says it is outside the PSI data, with no invented numbers. Checked in Task 12 with the system prompt test.
5. **Presenter key presses during an animation** (pressing → twice quickly): steps queue or clamp, never skip into a broken state. Test in Task 13.

---

## File Structure

```
src/
  main.tsx, App.tsx              app shell, section routing by presenter step
  styles/tokens.css               color, type, spacing tokens
  assets/logo.svg                 placeholder logo
  data/
    schema.ts                     Zod schemas + TS types for the dataset
    investigations.json           curated dataset (Task 3)
    insights.json                 pre-generated Claude text (Task 12)
    loadData.ts                   parse + validate at startup
  model/
    habitats.ts                   habitat + gravity presets
    logistic.ts                   flammability boundary model
    rank.ts                       relevance scoring
  state/store.ts                  global UI state (mission, sliders, step)
  components/
    Flame/FlameCanvas.tsx, flame.frag.glsl
    ConditionMap/ConditionMap.tsx
    RankedList/RankedList.tsx
    MissionPicker/MissionPicker.tsx
    StoryIntro/StoryIntro.tsx
    DnaCard/DnaCard.tsx, Compare.tsx
    GravityBridge/GravityBridge.tsx
    Ask/AskPanel.tsx
    EarthSection/EarthSection.tsx
    Source/SourceTip.tsx          hover tooltip showing provenance
  presenter/usePresenter.ts
api/ask.ts                        Vercel function, Claude Q&A
scripts/generate-insights.ts      build-time Claude text generation
tests/                            Vitest, mirrors src/
```

---

### Task 1: Scaffold the app

**Files:**
- Create: Vite React-TS project at repo root, `src/styles/tokens.css`, `src/assets/logo.svg`, `vitest.config.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm test`, `npm run build`; CSS custom properties `--bg`, `--surface`, `--text`, `--muted`, `--flame-blue`, `--flame-core`, `--flame-orange`, `--danger`, `--font-sans`, `--font-mono`.

- [ ] **Step 1:** `npm create vite@latest . -- --template react-ts`, then install `d3 motion zod @anthropic-ai/sdk` and dev deps `vitest @types/d3 tsx`.
- [ ] **Step 2:** Write `tests/smoke.test.ts` asserting `1 + 1 === 2`; run `npx vitest run`. Expected: 1 passed.
- [ ] **Step 3:** Define tokens in `tokens.css` (dark navy-black bg, flame palette used only for data and flame; fonts from Google Fonts: one clean sans, one technical mono). Placeholder flame SVG logo. App header shows logo, "FlameScope", "by Buffet Conquerers".
- [ ] **Step 4:** `npm run dev`, open in the browser pane, screenshot header. Checkpoint.

### Task 2: Dataset schema and loader

**Files:**
- Create: `src/data/schema.ts`, `src/data/loadData.ts`, `tests/data/schema.test.ts`

**Interfaces:**
- Produces:
  - `type Confidence = 'stated' | 'derived' | 'missing'`
  - `type Sourced<T> = { value: T | null; source: string | null; confidence: Confidence }`
  - `type Range = { min: number; max: number }`
  - `type Pillar = 'prevention' | 'detection' | 'suppression'`
  - `type Investigation = { id: string; name: string; years: string; platform: string; hardware: string; fuelPhase: 'solid'|'liquid'|'gas'|'aerosol'; fuels: string[]; sampleGeometry: Sourced<string>; o2Percent: Sourced<Range>; pressurePsi: Sourced<Range>; flowCmS: Sourced<Range>; diluents: string[]; varied: string[]; fixed: string[]; sensors: string[]; findings: { text: string; source: string }[]; pillars: Pillar[]; psiUrl: string | null; summary: string }`
  - `type TestPoint = { investigationId: string; o2Percent: number; pressurePsi: number | null; flowCmS: number | null; fuel: string; outcome: 'burned'|'extinguished'|'no_ignition'|'measured'; measured?: { name: string; value: number; unit: string }; source: string }`
  - `type Dataset = { investigations: Investigation[]; tests: TestPoint[]; generatedAt: string }`
  - `loadDataset(raw: unknown): Dataset` (throws with a readable message on invalid data)

- [ ] **Step 1: Failing tests** in `tests/data/schema.test.ts`:
  - `rejects a Sourced value with confidence 'stated' and null source`
  - `accepts a Sourced value with confidence 'missing', value null, source null`
  - `rejects duplicate investigation ids`
  - `rejects a TestPoint whose investigationId is not in investigations`
  - `rejects o2Percent outside 0..100`
- [ ] **Step 2:** Run `npx vitest run tests/data`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement Zod schemas with `superRefine` for the cross-field rules above; `loadDataset` wraps `Dataset.parse`.
- [ ] **Step 4:** Run tests. Expected: all pass. Checkpoint.

### Task 3: Curate the dataset (research task)

**Files:**
- Create: `src/data/investigations.json`, `docs/data-sources.md` (source list + what the team should spot-check)
- Test: `tests/data/dataset.test.ts`

**Interfaces:**
- Consumes: `loadDataset` (Task 2)
- Produces: a valid `investigations.json` covering BASS, BASS-II, Saffire-I/II/III, FLEX, FLEX-2, CFI, ACME (BRE, CFI-G, E-FIELD Flames + remaining ACME experiments), SPICE, SLICE, SAME, SAME-R, DAFT, DAFT-2.

- [ ] **Step 1: Failing test** `tests/data/dataset.test.ts`:
  - `investigations.json parses with loadDataset`
  - `contains every required investigation id` (list above)
  - `has at least 6 solid-fuel TestPoints with outcome burned or no_ignition` (feeds Task 4; if this cannot be met from sources, change the assertion to document the shortfall and Task 4 uses its fallback)
- [ ] **Step 2:** Open the PSI repository (`https://psi.nasa.gov/physci/repo/search?q=combustion`) in the browser pane; if a login is required, stop and ask the team to sign in in the pane. Record each dataset's URL and its listed conditions.
- [ ] **Step 3:** Fill gaps from the NASA Combustion Science page and *A Researcher's Guide to ISS Combustion Science*. Every value gets its source (URL + section/page) and confidence; unknown → `missing`.
- [ ] **Step 4:** Run `npx vitest run tests/data`. Expected: pass.
- [ ] **Step 5:** Write `docs/data-sources.md` listing 15 values for the team to spot-check. Hand it to the team. Checkpoint.

### Task 4: Flammability boundary model

**Files:**
- Create: `src/model/logistic.ts`, `tests/model/logistic.test.ts`

**Interfaces:**
- Consumes: `TestPoint` (Task 2)
- Produces:
  - `type FlamModel = { b0: number; bO2: number; bFlow: number; n: number; sourceIds: string[] }`
  - `fitLogistic(points: TestPoint[]): FlamModel | null` — uses points with `outcome` in `burned | no_ignition | extinguished` (burned = 1) and non-null `flowCmS`; returns `null` if fewer than 6 usable points or all one class.
  - `predictBurn(m: FlamModel, o2: number, flow: number): number` → probability 0..1
  - `boundaryO2(m: FlamModel, flow: number, p?: number): number` → O2 % where P = p (default 0.5)

- [ ] **Step 1: Failing tests:**
  - `returns null for 5 points`
  - `returns null when all points burned`
  - `on synthetic data burning above 18% O2, boundaryO2 at any flow is within 1.5 of 18`
  - `predictBurn increases with O2 at fixed flow`
  - `ignores points with null flowCmS`
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** Implement with standardized inputs, gradient descent (lr 0.1, 5000 iters) plus small L2 (λ = 0.01) to stay finite on separable data; unstandardize coefficients on return.
- [ ] **Step 4:** Run, expect PASS. Checkpoint.

### Task 5: Habitats and relevance ranking

**Files:**
- Create: `src/model/habitats.ts`, `src/model/rank.ts`, `tests/model/rank.test.ts`

**Interfaces:**
- Produces:
  - `type HabitatId = 'iss' | 'moon' | 'rover' | 'mars' | 'suit'`
  - `type Habitat = { id: HabitatId; label: string; o2Percent: number; pressurePsi: number; gravityG: number; assumed: boolean; note: string }`
  - `HABITATS: Record<HabitatId, Habitat>`, `GRAVITY_PRESETS = { micro: 0, moon: 0.166, mars: 0.38, earth: 1 }`
  - `type ScoreFactors = { conditionMatch: number; pillarMatch: number; materialMatch: number }` (each 0..1)
  - `type Weights = { condition: number; pillar: number; material: number }`, `DEFAULT_WEIGHTS = { condition: 0.5, pillar: 0.3, material: 0.2 }`
  - `scoreInvestigation(inv: Investigation, h: Habitat, w?: Weights): { total: number; factors: ScoreFactors }`
  - `rankInvestigations(invs: Investigation[], h: Habitat, w?: Weights): { inv: Investigation; total: number; factors: ScoreFactors }[]` sorted desc, ties by name

- [ ] **Step 1: Failing tests:**
  - `HABITATS.moon is 30% O2 at 10.2 psi`
  - `an investigation whose O2 range contains 30% scores conditionMatch 1 for moon`
  - `an investigation with o2Percent missing gets conditionMatch 0, not NaN`
  - `ranking for moon puts a high-O2 solid-fuel investigation above SAME`
  - `ranking is deterministic for equal scores`
- [ ] **Step 2:** Run, expect FAIL.
- [ ] **Step 3:** `conditionMatch` = 1 if habitat point lies within the O2 range, else `exp(-distance/10)` in O2 % units, pressure blended in when present. `pillarMatch` = fraction of `['prevention','detection','suppression']` covered. `materialMatch` = 1 for solid fuels (cabin materials), 0.6 gas, 0.4 liquid, 0.3 aerosol.
- [ ] **Step 4:** Run, expect PASS. Checkpoint.

### Task 6: App state and Live Flame

**Files:**
- Create: `src/state/store.ts`, `src/components/Flame/FlameCanvas.tsx`, `src/components/Flame/flame.frag.glsl`, `src/components/Flame/FlameControls.tsx`

**Interfaces:**
- Produces:
  - `useStore()` with `{ habitat: HabitatId; o2: number; pressure: number; flow: number; gravity: number; step: number; compare: [string|null, string|null]; setHabitat(id); setCondition(partial); setStep(n); setCompare(a, b) }`. `setHabitat` also sets o2/pressure/gravity to the habitat values.
  - `<FlameCanvas o2 pressure flow gravity />`

- [ ] **Step 1:** Implement store with React context + `useReducer` (no extra library).
- [ ] **Step 2:** Fragment shader uniforms `u_time, u_o2, u_pressure, u_flow, u_gravity`. Behavior: gravity 1 → elongated flickering teardrop, yellow-orange; gravity 0 → near-spherical, dim blue, no flicker; flow skews the flame downstream; higher O2 → larger, brighter, more yellow-white. Smooth interpolation between states.
- [ ] **Step 3:** `FlameControls`: four sliders (O2 10–100%, pressure 1–15 psi, flow 0–50 cm/s, gravity presets + slider) with mono numeric readouts.
- [ ] **Step 4:** Verify in the browser pane: screenshots at gravity 1 and 0, O2 21 and 30. Checkpoint.

### Task 7: Condition map

**Files:**
- Create: `src/components/ConditionMap/ConditionMap.tsx`, `src/components/Source/SourceTip.tsx`

**Interfaces:**
- Consumes: `Dataset`, `HABITATS`, `fitLogistic`, `boundaryO2`, store
- Produces: `<ConditionMap dataset model xAxis="pressure"|"flow" />`, `<SourceTip source confidence>{children}</SourceTip>`

- [ ] **Step 1:** D3 scatter: x = pressure (psi) or flow (cm/s, toggle), y = O2 %. Dots colored per investigation; points with null x value are omitted and counted in a "N tests not plotted (no value reported)" note.
- [ ] **Step 2:** Habitat zones as labeled markers/regions; the selected habitat pulses. Crosshair follows the store's sliders.
- [ ] **Step 3:** In flow mode, draw the model's 0.5 boundary and a 0.2–0.8 band labeled "Fit to N tests from …". If the model is `null`, draw the published-limit fallback line with the label "Sketched from published limiting-O2 values".
- [ ] **Step 4:** Hover a dot → `SourceTip` with values, source link and confidence. Click → opens that investigation's DnaCard.
- [ ] **Step 5:** Verify in the pane with Moon base selected; screenshot. Checkpoint.

### Task 8: Mission picker and ranked list

**Files:**
- Create: `src/components/MissionPicker/MissionPicker.tsx`, `src/components/RankedList/RankedList.tsx`

**Interfaces:**
- Consumes: `HABITATS`, `rankInvestigations`, `insights.json` (Task 12; until then, `Investigation.summary`)

- [ ] **Step 1:** MissionPicker: five habitat tiles showing O2 %, psi and gravity; Mars tile marked "assumed".
- [ ] **Step 2:** RankedList: `motion` `layout` animation on reorder; each row shows score bar split into its three factors, pillar tags and the "why it matters for <habitat>" line.
- [ ] **Step 3:** Weight sliders (collapsed "How is this ranked?" panel) adjust `Weights` live.
- [ ] **Step 4:** Verify switching ISS → Moon reorders with animation. Checkpoint.

### Task 9: Story intro and Back on Earth

**Files:**
- Create: `src/components/StoryIntro/StoryIntro.tsx`, `src/components/EarthSection/EarthSection.tsx`, `src/data/incidents.ts`, `src/data/spinoffs.ts`

**Interfaces:**
- Produces: `INCIDENTS: { id; year; title; summary; failureMode; linkedInvestigationIds: string[]; sourceUrl }[]`, `SPINOFFS: { id; title; summary; linkedInvestigationIds; sourceUrl }[]`

- [ ] **Step 1:** Incidents: Apollo 1 (1967), Apollo 13 (1970), Mir (1997), Artemis II alarm (quote attributed to the commander, short). Text summarized from the challenge's reference links, with `sourceUrl`.
- [ ] **Step 2:** StoryIntro: animated timeline, each incident reveals then draws a line to its linked investigations; closes on "The data exists. It's just buried." with a "Pick a mission" button.
- [ ] **Step 3:** EarthSection: three spinoffs (air tanks, smoke detector, fire attire) plus water-mist extinguishers, and the SAME → DAFT smoke-vs-dust link.
- [ ] **Step 4:** Verify both in the pane. Checkpoint.

### Task 10: DNA cards and Compare

**Files:**
- Create: `src/components/DnaCard/DnaCard.tsx`, `src/components/DnaCard/Compare.tsx`, `src/model/compare.ts`, `tests/model/compare.test.ts`

**Interfaces:**
- Produces: `diffInvestigations(a: Investigation, b: Investigation): { same: string[]; different: { field: string; a: string; b: string }[] }`

- [ ] **Step 1: Failing tests:** `same hardware is listed under same`; `different fuelPhase listed under different with both values`; `missing values render as "not reported"`.
- [ ] **Step 2:** Run, expect FAIL; implement over fields hardware, platform, fuelPhase, fuels, o2Percent, pressurePsi, flowCmS, sensors, pillars; run, expect PASS.
- [ ] **Step 3:** DnaCard: compact visual fingerprint (fuel phase glyph, hardware badge, O2/pressure/flow range bars on shared scales, sensor chips, findings with SourceTips). Compare puts two side by side with same/different highlighted.
- [ ] **Step 4:** Verify FLEX vs BASS in the pane. Checkpoint.

### Task 11: Gravity bridge

**Files:**
- Create: `src/components/GravityBridge/GravityBridge.tsx`

- [ ] **Step 1:** Horizontal gravity axis 0 → 1g with Moon and Mars marked. Microgravity and 1g findings for the selected quantity (from dataset findings) as end bounds; shaded uncertainty band between; label "No partial-gravity data in PSI yet".
- [ ] **Step 2:** Callouts: E-FIELD Flames (electric field mimicking buoyancy) and upcoming LUCI and FM2.
- [ ] **Step 3:** Verify in the pane. Checkpoint.

### Task 12: Claude layer (pre-generated + live Ask)

Load the `claude-api` skill before writing this task's code (model ids, SDK usage).

**Files:**
- Create: `scripts/generate-insights.ts`, `src/data/insights.json`, `api/ask.ts`, `src/components/Ask/AskPanel.tsx`, `src/components/Ask/askClient.ts`, `src/data/cachedAnswers.json`, `tests/ask/askClient.test.ts`, `tests/ask/prompt.test.ts`, `api/prompt.ts`

**Interfaces:**
- Produces:
  - `insights.json`: `{ [investigationId]: { summary: string; why: Record<HabitatId, string> } }`
  - `buildSystemPrompt(dataset: Dataset): string` in `api/prompt.ts`
  - `POST /api/ask` body `{ question: string }` → `{ answer: string; citations: { investigationId: string; source: string }[] }`
  - `ask(question: string, fetchFn?: typeof fetch): Promise<{ answer; citations; cached: boolean }>`

- [ ] **Step 1: Failing tests:**
  - `askClient returns a cached answer with cached=true when fetch rejects`
  - `askClient returns cached=true when the response is not ok`
  - `askClient times out after 15 s and falls back`
  - `buildSystemPrompt includes every investigation id and the rule to answer only from the data and to say when a question is outside it`
- [ ] **Step 2:** Run, expect FAIL; implement; run, expect PASS.
- [ ] **Step 3:** `generate-insights.ts`: for each investigation, ask Claude for a 2-sentence plain summary and a one-line "why it matters" per habitat, using only that investigation's JSON as input; write `insights.json`. Run once the team provides the key (`ANTHROPIC_API_KEY=… npx tsx scripts/generate-insights.ts`). Until then, the UI uses `Investigation.summary`.
- [ ] **Step 4:** `cachedAnswers.json`: 6 demo questions with answers (for example "What does the data say about 30% O2?", "Which experiments tested suppression?").
- [ ] **Step 5:** AskPanel: suggested-question chips, answer streams in, citations as clickable chips that open DnaCards; "cached answer" badge when offline.
- [ ] **Step 6:** Verify in the pane with no key (cached path). Checkpoint.

### Task 13: Presenter mode and layout assembly

**Files:**
- Create: `src/presenter/usePresenter.ts`, `tests/presenter/usePresenter.test.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `STEPS = ['intro','mission','flame','map','ranking','gravity','compare','ask','earth'] as const`; `nextStep(current: number, total: number): number`, `prevStep(current: number): number` (both clamp).

- [ ] **Step 1: Failing tests:** `nextStep clamps at last step`; `prevStep clamps at 0`; `two rapid next presses advance exactly two steps`.
- [ ] **Step 2:** Run, expect FAIL; implement; run, expect PASS.
- [ ] **Step 3:** Keys: → / Space next, ← back, 1–9 jump, `P` toggles a small step indicator. Each step scrolls/animates to its section and sets the demo state (step `mission` selects Moon base, step `map` switches to flow axis).
- [ ] **Step 4:** Assemble App layout: intro full-screen, then the main grid (flame | map, ranked list below), then gravity, compare, ask, earth.
- [ ] **Step 5:** Walk the full presenter path in the pane at 1920×1080 and 1440×900; screenshot each step. Checkpoint.

### Task 14: Deploy and final verification

**Files:**
- Create: `vercel.json`, `README.md` (run, deploy, where the key goes, demo script)

- [ ] **Step 1:** `npm test` (all pass) and `npm run build` (no errors).
- [ ] **Step 2:** Team runs `vercel` deploy with `ANTHROPIC_API_KEY` set in the Vercel dashboard (the team does this; Claude does not create accounts).
- [ ] **Step 3:** On the deployed URL: walk the presenter path; turn Wi-Fi off and confirm everything except live Ask works and Ask falls back.
- [ ] **Step 4:** README demo script: the 9 steps with one talking point each.
