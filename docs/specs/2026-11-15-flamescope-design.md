# FlameScope: Design

Team: **Buffet Conquerers** · Event: NASA Space Apps 2026, "Flame in Freefall"
Working name: **FlameScope** (placeholder flame logo until the team picks one)

## 1. Intent

Build an interactive, AI-assisted web dashboard that turns NASA PSI microgravity combustion data into fire-safety answers for crewed habitats (ISS, Moon base, pressurized rover, Mars, spacesuit).

The core message the demo must land:
**"The Moon base will run at about 30% oxygen and 10.2 psi. Here is what the data says about flammability there, and here is where the data runs out."**

It must feel crafted and physical (animated flame, live map, real numbers with sources), not like a generic AI dashboard (chat box plus gradient cards).

## 2. Goals, non-goals, anti-goals

**Goals**
- Summarize about 15 to 20 PSI combustion investigations: objective, fuel, sample shape and size, O2 %, pressure, flow, what varied between tests, sensors, key findings.
- Rank investigations by relevance to a chosen habitat and safety pillar (prevention, detection, suppression).
- Show tested conditions against habitat atmospheres on one map, including the gaps.
- Provide one small, honest predictive model (flammability boundary) that supports the "predictive modeling" objective.
- Grounded AI explanations and Q&A that cite their sources.
- Work reliably during a **live presentation**.

**Non-goals**
- Full ingestion of raw PSI data files.
- Large ML or neural models.
- User accounts, saved data, admin tools.
- Rocket or propellant combustion (out of scope per the challenge).

**Anti-goals (failure even if it "works")**
- Any number without a traceable source.
- AI that invents values or answers outside the dataset.
- A demo that breaks when the venue Wi-Fi is bad.
- Looking like a template dashboard.

## 3. Constraints

- About one day of build time. Claude builds; the team verifies data, provides the API key, and presents.
- Live presentation, so it needs a presenter-friendly flow and an offline fallback.
- PSI site is JavaScript-rendered and may need a free login for some pages.

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. React + TypeScript (Vite) single-page app, WebGL flame, D3 charts, one small serverless function calling Claude, curated JSON dataset, pre-generated AI text** | Needs an API key for live Q&A only; everything else works offline | **Chosen.** Only option that delivers the visuals and finishes in a day |
| B. Next.js full stack with RAG over NASA PDFs | Impressive on paper, but plumbing eats the day and reliability is low | Rejected |
| C. Python Streamlit dashboard | Fastest, but generic look and no custom animation | Rejected (fails the "not slop" goal) |

## 5. Data

**Source of truth:** one file, `data/investigations.json`, curated by Claude.

**Sources, in priority order**
1. PSI repository dataset pages (conditions, test matrices, dataset IDs, links).
2. NASA Combustion Science pages and *A Researcher's Guide to ISS Combustion Science* (objectives, hardware, findings).
3. Published NASA papers linked from PSI, only when needed to fill a specific value.

**Investigations to cover:** BASS, BASS-II, Saffire-I, -II, -III, FLEX, FLEX-2, CFI, ACME (BRE, CFI-G, E-FIELD Flames, and the other three), SPICE, SLICE, SAME, SAME-R, DAFT, DAFT-2. Extras only if time allows.

**Per investigation:** id, name, years, platform, hardware (MSG, CIR/MDCA, CIR/ACME, Cygnus for Saffire), fuel phase (solid, liquid droplet, gas), fuels, sample geometry and size, O2 range, pressure range, flow range, diluents, what varied, what stayed fixed, sensors and measurements, key findings, safety pillar tags, habitat relevance notes, PSI link.

**Per test point (where available):** investigation id, O2 %, pressure, flow speed, fuel, outcome (burned, extinguished, no ignition), measured value (for example spread rate), source.

**Provenance rule:** every value carries `source` (URL plus location) and `confidence` = `stated`, `derived` or `missing`. Missing stays empty. The UI shows the source on hover.

**Team role:** spot-check a sample of values against the sources while the build continues. If PSI needs a login, a team member signs in inside the browser pane; Claude never handles passwords.

## 6. The model and the "intelligence"

1. **Flammability boundary model.** Logistic regression of P(sustained burning) against O2 % and flow speed, fit to burn and no-burn test points from the solid-material investigations (BASS, BASS-II, Saffire if available). Drawn on the condition map with an uncertainty band. Labeled with N tests and its sources. If the data is too thin, it is presented as a sketched boundary from published limiting-O2 values, labeled as such.
2. **Relevance ranking.** Transparent score per habitat: closeness of tested conditions to the habitat atmosphere, plus safety-pillar match, plus fuel and material relevance. Every factor is visible in the UI.
3. **Claude (the SI layer).**
   - Pre-generated at build time: per-investigation summaries and "why it matters for <habitat>" text, cached in JSON, so the demo works offline.
   - Live: Q&A answered only from the dataset, with citations. Falls back to cached sample answers if offline or no key.
   - Model: Claude via a small serverless function; the API key lives only in an environment variable.

## 7. App structure

1. **Story intro.** Animated timeline: Apollo 1, Apollo 13, Mir, the Artemis II alarm quote. Each incident links to the investigations that address its failure mode. Ends with "the data exists, but it's buried."
2. **Mission picker.** ISS, Moon base, pressurized rover, Mars, spacesuit. Sets the atmosphere preset everywhere.
3. **Main view (the "wow" screen)**
   - **Live flame:** WebGL shader; sliders for O2 %, pressure, flow, gravity (0g, Moon, Mars, Earth). The shape moves from a flickering teardrop (1g) to a dim blue sphere (0g); brightness and size grow with O2.
   - **Condition map:** O2 % vs pressure (toggle: vs flow). Every test is a dot colored by investigation. Habitat zones overlaid. Flammability boundary drawn. The sliders move a crosshair on the map.
   - **Ranked list:** investigations animate into new order when the mission changes, each with an AI "why it matters" line.
4. **Gravity bridge.** For Moon and Mars, the microgravity and 1g results shown as bounds with a shaded uncertainty band, plus a note on E-FIELD Flames (simulated partial gravity) and the upcoming LUCI and FM2 experiments.
5. **Investigation detail and Compare.** "DNA card" fingerprint per investigation; two cards side by side with similarities and differences highlighted.
6. **Ask.** Grounded Q&A with clickable citations.
7. **Back on Earth.** Water-mist extinguishers, the smoke detector that tells smoke from dust (and the SAME to DAFT link), firefighter gear and air tanks.

## 8. Live presentation support

- **Presenter mode:** arrow keys or number keys step through a scripted demo path (intro, Moon base, sliders, map gap, ranking, ask, Earth).
- **Offline-safe:** all data and AI text bundled; live Q&A is optional.
- Built and tested at 1920×1080 and on a laptop screen; dark theme suited to projectors.

## 9. Visual direction

Dark "mission control" look, but specific to fire: deep navy-black background, flame colors (blue core to orange) used only for data and the flame, a technical monospace for numbers, a clean sans for text. Motion is purposeful: reordering, morphing, the flame itself. No stock gradients or emoji icons.

## 10. Left to the builder

Exact libraries (motion, D3 vs visx), shader details, color values, scoring weights (shown and tunable in the UI), hosting choice (Vercel or Netlify), and the extra three ACME experiments' coverage depth.
