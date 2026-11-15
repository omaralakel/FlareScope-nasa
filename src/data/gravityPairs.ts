/**
 * Paired microgravity / 1 g results from SAFFIRE-II (PSI-99). Each sample was burned in
 * microgravity on orbit and the same configuration was burned in 1 g, all at about 20 cm/s
 * flow and about 21.5-22.1% O2, sample length 29 cm. Values are copied as text exactly as
 * written in the PSI table (including "~ 0", "Complete", "Acceleratory", "n/a").
 * A spreadRate of null means the table cell reads "n/a".
 */
export type GravityPair = {
  id: string;
  material: string;
  thickness: string;
  flowDirection: string;
  o2Percent: string;
  microG: { burnLength: string; spreadRate: string | null };
  oneG: { burnLength: string; spreadRate: string | null };
  note?: string;
  source: string;
  psiUrl: string;
};

export const PSI_99_URL = 'https://psi.nasa.gov/physci/repo/data/investigations/PSI-99';
export const SAFFIRE_II_ID = 'saffire-ii';
/** Sample length in the table, used to explain what "Complete" means. */
export const SAMPLE_LENGTH = '29 cm';

const src = (row: number) => `PSI-99 Experimental table PSI-99_Experimental table_SAFFIRE-2.csv, row ${row}`;
const NOTE_037 = 'Thickness is written "037 mm" in the PSI table.';

export const GRAVITY_PAIRS: GravityPair[] = [
  {
    id: '2-1', material: 'Silicone', thickness: '0.27 mm', flowDirection: 'Concurrent', o2Percent: '~ 21.5',
    microG: { burnLength: '~ 0', spreadRate: null },
    oneG: { burnLength: 'Complete', spreadRate: 'Acceleratory' },
    source: src(1), psiUrl: PSI_99_URL,
  },
  {
    id: '2-2', material: 'Silicone', thickness: '0.61 mm', flowDirection: 'Concurrent', o2Percent: '~ 22.1',
    microG: { burnLength: '~ 0', spreadRate: null },
    oneG: { burnLength: '7.6 cm', spreadRate: '1.2 mm/s' },
    source: src(2), psiUrl: PSI_99_URL,
  },
  {
    id: '2-3', material: 'Silicone', thickness: '1.03 mm', flowDirection: 'Concurrent', o2Percent: '~ 22.1',
    microG: { burnLength: '~ 0', spreadRate: null },
    oneG: { burnLength: '~ 0', spreadRate: null },
    source: src(3), psiUrl: PSI_99_URL,
  },
  {
    id: '2-4', material: 'Silicone', thickness: '037 mm', flowDirection: 'Opposed', o2Percent: '~ 22.1',
    microG: { burnLength: '~ 0', spreadRate: null },
    oneG: { burnLength: 'Complete', spreadRate: '0.6 mm/s' },
    note: NOTE_037,
    source: src(4), psiUrl: PSI_99_URL,
  },
  {
    id: '2-5', material: 'Cotton-Fiberglass (SIBAL)', thickness: '037 mm', flowDirection: 'Concurrent', o2Percent: '~ 22.1',
    microG: { burnLength: '29 cm', spreadRate: '2.1 mm/s' },
    oneG: { burnLength: 'Complete', spreadRate: 'Acceleratory' },
    note: NOTE_037,
    source: src(5), psiUrl: PSI_99_URL,
  },
  {
    id: '2-6', material: 'Cotton-Fiberglass (SIBAL)', thickness: '037 mm', flowDirection: 'Concurrent', o2Percent: '~ 22.1',
    microG: { burnLength: '29 cm', spreadRate: '2.6 mm/s' },
    oneG: { burnLength: 'Complete', spreadRate: 'Acceleratory' },
    note: `${NOTE_037} The material cell is blank in the table; it continues the row above.`,
    source: src(6), psiUrl: PSI_99_URL,
  },
  {
    id: '2-7', material: 'PMMA & Nomex', thickness: '0.85 and 0.37 mm', flowDirection: 'Concurrent', o2Percent: '~ 22.1',
    microG: { burnLength: '5 cm & 0 (note 2)', spreadRate: 'n/a (Nomex)' },
    oneG: { burnLength: '~ 0 (Nomex)', spreadRate: 'n/a (Nomex)' },
    note: 'Note 2: The PMMA portion was completely consumed but the Nomex was not ignited.',
    source: src(7), psiUrl: PSI_99_URL,
  },
  {
    id: '2-8', material: 'PMMA', thickness: 'See Fig. 5', flowDirection: 'Concurrent', o2Percent: '22.1 to 22.0',
    microG: { burnLength: '~ 10 cm (note 3)', spreadRate: 'Note 4' },
    oneG: { burnLength: 'Complete', spreadRate: 'Acceleratory' },
    note:
      'Note 3: This is the length of fuel with significant visible damage. Note 4: The flames remain anchored at the base of the sample which has a very slow regression rate (0.01 to 0.04 mm/s).',
    source: src(8), psiUrl: PSI_99_URL,
  },
  {
    id: '2-9', material: 'PMMA', thickness: '1 cm', flowDirection: 'Concurrent', o2Percent: '22.0 to 21.9',
    microG: { burnLength: '~ 10 cm (note 4)', spreadRate: 'Note 4' },
    oneG: { burnLength: 'Complete', spreadRate: 'Acceleratory' },
    note:
      'Note 4: The flames remain anchored at the base of the sample which has a very slow regression rate (0.01 to 0.04 mm/s). The material cell is blank in the table; it continues the row above.',
    source: src(9), psiUrl: PSI_99_URL,
  },
];

/** True when the table records a burn length of about zero ("~ 0"). */
export const isNoBurn = (burnLength: string) => burnLength.trim().startsWith('~ 0');

/** Samples with ~0 burn length in microgravity that burned completely in 1 g. */
export const orbitPassEarthFail = (pairs: GravityPair[]) =>
  pairs.filter((p) => isNoBurn(p.microG.burnLength) && p.oneG.burnLength === 'Complete');
