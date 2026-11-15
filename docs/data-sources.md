# FlameScope data sources

`src/data/investigations.json` is the single source of truth for the app. It is
generated, not hand-edited:

```
npx tsx scripts/build-dataset.ts
```

The script reads the NASA PSI downloads in `data-raw/psi/` and merges in the
hand-written text from `scripts/curated/investigations.curated.json`. The test
`tests/data/dataset.test.ts` checks that the checked-in JSON equals a fresh
build, so the two cannot drift apart.

## 1. Sources

### Primary: NASA Physical Sciences Informatics (PSI) repository

Each investigation's record (`PSI-<n>.json`: title, objective, approach,
hypothesis, research impacts, hardware, dates, publications) and its
experimental table (`PSI-<n>_Experimental table_*.csv`), downloaded into
`data-raw/psi/`. Record page: `https://psi.nasa.gov/physci/repo/data/investigations/PSI-<n>`.

| id | Investigation | PSI | Experimental table(s) |
|---|---|---|---|
| bass | BASS | PSI-26 | BASS.csv |
| bass-ii | BASS-II | PSI-25 | BASS-II.csv |
| saffire-i | Saffire-I | PSI-98 | SAFFIRE-1.csv |
| saffire-ii | Saffire-II | PSI-99 | SAFFIRE-2.csv |
| saffire-iii | Saffire-III | PSI-100 | SAFFIRE-3.csv |
| flex | FLEX | PSI-69 | FLEX.csv |
| flex-2 | FLEX-2 | PSI-68 | Flex2.csv |
| cfi | CFI | PSI-39 | CFI.csv |
| acme-cfi-g | ACME CFI-G | PSI-159 | CFI-G_Inverse Flames.csv, CFI-G_Normal Flames.csv |
| acme-flame-design | ACME Flame Design | PSI-10 | Flame Design_Inverse Flame.csv, Flame Design_Normal Flame.csv |
| acme-cld | ACME CLD Flame | PSI-21 | CLD Flame.csv |
| acme-bre | ACME BRE | PSI-20 | ACME BRE.csv |
| acme-e-field | ACME E-FIELD Flames | PSI-22 | ACME E-FIELD Flames.csv |
| acme-s-flame | ACME s-Flame | PSI-23 | ACME s-Flame.csv |
| spice | SPICE | PSI-107 | Spice.csv |
| slice | SLICE | PSI-106 | Slice.csv |
| same | SAME | PSI-102 | SAME.csv |
| same-r | SAME-R | PSI-101 | SAME-R.csv |

DAFT and DAFT-2 are not in PSI and are not in the dataset.

### Secondary (only to fill gaps the PSI records leave)

- NASA ISS Program Science Office, *A Researcher's Guide to: Combustion Science*
  (NP-2015-10-034-JSC):
  https://www.nasa.gov/sites/default/files/atoms/files/np-2015-10-034-jsc_combustion_in_reduced_gravity-iss-mini-book-011116-508.pdf
  Used for: BASS findings (p. 31), FLEX findings (p. 12, p. 33), SPICE year and
  smoke-point meaning (p. 13), SLICE year and hardware (p. 14), SAME flight year
  (p. 45: "SAME project in 2007 and 2010, SPICE project in 2009, SLICE project in 2012").
- Saffire flight years (the `years` field only; the PSI record dates for
  Saffire-I, 2001-2008, look copied from SAME):
  NASA release https://www.nasa.gov/news-release/nasa-glenn-successfully-ignites-largest-fire-experiment-in-space (Saffire-I, June 2016),
  https://www.space.com/34789-nasa-space-fire-experiment-saffire.html (Saffire-II, Nov 2016),
  https://www.americaspace.com/2020/05/11/cygnus-departs-space-station-2-weeks-of-saffire-experiments-planned/ (Saffire-III, June 2017).

## 2. How sources are written in the JSON

- PSI record field: `PSI-<n> record: <field>; <psiUrl>`
- Publication listed in the record: `PSI-<n> record: publications, "<title>"; <psiUrl>`
- Experimental table row: `PSI-<n> Experimental table <file name>, row <k>`.
  `k` is the 1-based data row, header excluded (row 1 = line 2 of the CSV).
- Researcher's Guide: `NASA ISS Program Science Office, "A Researcher's Guide to: Combustion Science" (NP-2015-10-034-JSC), p. <N>; <url>`
- Investigation ranges built from rows: `Derived from <N> test rows in PSI-<n> Experimental table <files>; <psiUrl>`

## 3. CSV to field mapping rules

General:

- O2: mole fraction x 100 -> `o2Percent`; values already in % kept. `~ 21.5`
  -> 21.5; ranges like `21.5 - 21.7` or `22.1 to 22.0` -> midpoint. Rows with no
  parseable O2 are skipped (no test point).
- Pressure -> psi: atm x 14.696, bar x 14.504, mmHg x 0.019337. Missing -> null.
- Flow: only when the table states cm/s. Fan or display settings, pot settings
  and mg/s fuel rates are not flow -> null. Negative velocities (SPICE -0.28 and
  -5.92) are sensor offsets and are left out of the range.
- `measured` is only filled with a number the table gives.
- Investigation ranges (`o2Percent`, `pressurePsi`, `flowCmS`): `derived` from
  the test points, else `derived` from a cm/s column of the table, else `stated`
  from the record text or a table that lists ranges, else `missing`.

Per table:

| Table | O2 | Pressure | Flow | Outcome |
|---|---|---|---|---|
| BASS-II | Calibrated initial O2 % | none | none (fan/air display) | crew notes in Fan/Air display: "no ign" -> no_ignition; "ext", "blowoff", "out", "would not stay lit" -> extinguished; "ign"/"ignited" -> burned; else measured (Final CO2 %) |
| Saffire-I | Percent O2 | none | Air Flow (cm/s) | Burn Time > 0 -> burned (measured burn time) |
| Saffire-II | Percent O2 (Note 1) | none | Air Flow "20 cm/s" | microgravity burn length > 0 -> burned (spread rate or burn length); burn length ~0 -> measured (burn length 0 cm). Row 2-7 is split: PMMA burned, Nomex no_ignition (Note 2). Blank Material cells continue the material above (merged cells). |
| Saffire-III | none (no test points) | none | Air Flow 30 cm/s -> range | n/a |
| FLEX | O initial mole fraction | Ambient pressure mmHg | none | Test end: Extinction -> extinguished (extinction diameter, or burning rate); Completion -> burned (burning rate); Disruption -> measured (burning rate). Fuel tagged "(CO2-diluted)"/"(He-diluted)" when that column > 0. Burning rate header says "mm"; it is stored as the burning-rate constant in mm^2/s. |
| CFI | Oxygen | Pressure "x atm" | none | measured (table has no result column) |
| CFI-G inverse/normal | XO2 (inverse: oxidizer issued from the burner) / XO2 before test | approx p (bar) | none (mg/s) | Hot ignition No -> no_ignition; Yes + SE -> extinguished; Yes + FT or "-" -> burned (burn time); "flash" -> measured. Blank Fuel cells continue the fuel above. |
| Flame Design inverse/normal | XO2 / XO2 (init) | pmean (atm) | none (mg/s) | measured with Tad (adiabatic flame temperature, a calculated value listed in the table). RAMP / LOW O2 rows skipped. |
| ACME BRE | each value in "Oxygen Conc" (notes: concentrations of tests that ignited) | none ("pressures varied but not identified") | none | burned, one point per listed O2 on days with Flames Ignited > 0. "3400%" and "2100%" are not parsed. |
| ACME s-Flame | each "~xx%" in Atmosphere | none per row (notes: ~1 atm) | none | burned, one point per O2 on days with flames ignited. "N3", "N4"... in text are spreadsheet fill artifacts for N2. |
| SPICE, SAME, SAME-R | none (no test points) | none | Air Rate / Air Flow / Inlet velocity (cm/s) -> range | n/a |
| BASS, CLD, E-FIELD, SLICE, FLEX-2 | no per-test O2 | | | no test points |

## 4. What the data contains

1215 test points: measured 577, extinguished 386, burned 188, no_ignition 64.

| id | points | burned | no_ignition | extinguished | measured | with pressure | with flow |
|---|---|---|---|---|---|---|---|
| bass-ii | 129 | 2 | 1 | 25 | 101 | 0 | 0 |
| saffire-i | 2 | 2 | 0 | 0 | 0 | 0 | 2 |
| saffire-ii | 10 | 5 | 1 | 0 | 4 | 0 | 10 |
| flex | 274 | 27 | 0 | 186 | 61 | 273 | 0 |
| cfi | 87 | 0 | 0 | 0 | 87 | 87 | 0 |
| acme-cfi-g | 333 | 88 | 62 | 175 | 8 | 333 | 0 |
| acme-flame-design | 316 | 0 | 0 | 0 | 316 | 296 | 0 |
| acme-bre | 41 | 41 | 0 | 0 | 0 | 0 | 0 |
| acme-s-flame | 23 | 23 | 0 | 0 | 0 | 0 | 0 |

Solid fuels (BASS, BASS-II, Saffire): 11 burned/no_ignition points
(9 burned, 2 no_ignition). 8 have a cm/s flow (all 20 cm/s, Saffire); none has a
pressure.

## 5. Known gaps

- No PSI table gives a pressure for any solid-fuel test. Solid-fuel points sit
  near ISS cabin air (about 21-22% O2) except BASS-II, which goes down to 13.6%.
- BASS-II flow is only given as fan/air display settings, so flow is null.
  The record says up to 40 cm/s but gives no lower bound, so `flowCmS` is missing.
- BASS, Saffire-III, SPICE, SAME, SAME-R, CLD, E-FIELD and SLICE tables have
  no O2 column: no test points.
- Most BASS-II rows have no explicit ignition note; they are `measured`, not
  `burned`. Rows ending in extinction were burning first but are stored as
  `extinguished`.
- Saffire-II silicone (rows 1-4): burn length ~0 but the table does not say
  "not ignited", so they are `measured`, not `no_ignition`.
- CFI-G and Flame Design inverse flames: the O2 value is the oxidizer stream
  from the burner (up to 85%), not the room atmosphere. Investigation O2 ranges
  for these include those values.
- SPICE flow range from the table (0.66-85.28 cm/s) is wider than the record
  text (5.4-65 cm/s).
- Record dates are investigation lifetimes, not flight dates; ACME CFI-G has no
  dates in its record.
- FLEX-2 has only a table of ranges (stated), no individual tests.

## 6. Spot-check list for the team (15 values)

| # | Investigation | Field | Value in JSON | Where to look |
|---|---|---|---|---|
| 1 | FLEX | test row 2 o2Percent / pressurePsi / outcome | 21 / 14.7348 (762 mmHg) / extinguished, extinction diameter 0.94 mm | FLEX.csv line 3 |
| 2 | FLEX | test row 20 | 34% O2, 10.4323 psi (539.5 mmHg), burned, burning rate 0.53 | FLEX.csv line 21 |
| 3 | FLEX | investigation o2Percent | 12-34 % (derived) | FLEX.csv column "O initial ambient composition" |
| 4 | BASS-II | test row 61 (O12) | 13.6% O2, no_ignition, 3/8" clear rod | BASS-II.csv line 62, "no ign at any flow" |
| 5 | BASS-II | investigation o2Percent | 13.6-22.2 % | BASS-II.csv column "Calibrated initial O2 % by vol" |
| 6 | Saffire-I | test row 1 | 21.6% O2 (midpoint of 21.5-21.7), 20 cm/s, burned, burn time 420 s | SAFFIRE-1.csv line 2 |
| 7 | Saffire-II | test row 5 | SIBAL, 22.1% O2, 20 cm/s, burned, spread 2.1 mm/s | SAFFIRE-2.csv line 6 |
| 8 | Saffire-II | test row 7 (two points) | PMMA burned 5 cm; Nomex no_ignition | SAFFIRE-2.csv line 8 and Note 2 |
| 9 | Saffire-III | flowCmS | 30-30 cm/s | SAFFIRE-3.csv, Air Flow column |
| 10 | ACME CFI-G | inverse row 1 | ethane, 21% O2, 15.9544 psi (1.10 bar), no_ignition | CFI-G_Inverse Flames.csv line 2 ("Failed to ignite") |
| 11 | ACME CFI-G | normal row 1 | ethane, 39.39% O2, 13.6975 psi (0.9443956 bar), extinguished (SE), burn time 50 s | CFI-G_Normal Flames.csv line 2 |
| 12 | ACME Flame Design | inverse row 1 | 37.0828% O2, 14.7551 psi (1.00401873 atm) | Flame Design_Inverse Flame.csv line 2 |
| 13 | ACME BRE | pressurePsi (stated) | 8.2-14.7 psi | PSI-20 record, objective 1 |
| 14 | CFI | investigation pressurePsi | 7.348-73.48 psi (0.5-5 atm) | CFI.csv "Pressure" column |
| 15 | FLEX-2 | o2Percent / pressurePsi (stated) | 10-40 % / 7.348-44.088 psi | PSI-68 record, approach (0.1-0.4 mole fraction, 0.5-3.0 atm) |
