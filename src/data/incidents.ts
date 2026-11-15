/**
 * Real spacecraft fire and fire-alarm incidents for the Story intro.
 * Summaries are our own short wording of the linked source page.
 * Each linked investigation carries a `why` explaining the connection.
 */

export type InvestigationLink = { id: string; why: string };

export type Incident = {
  id: string;
  year: number;
  title: string;
  summary: string;
  failureMode: string;
  /** Optional short quote, attributed. */
  quote?: { text: string; by: string };
  links: InvestigationLink[];
  linkedInvestigationIds: string[];
  sourceUrl: string;
  sourceLabel: string;
  /** Scope note shown when the incident only partly falls inside PSI's combustion data. */
  scopeNote?: string;
};

const ids = (links: InvestigationLink[]) => links.map((l) => l.id);

const apollo1: InvestigationLink[] = [
  { id: 'bass', why: 'BASS burned spacecraft materials (cotton-fiberglass, PMMA, Nomex) to see how they spread fire in microgravity.' },
  { id: 'bass-ii', why: 'BASS-II burned PMMA, cotton-fiberglass and Nomex while changing oxygen level and airflow.' },
  { id: 'saffire-i', why: 'Saffire-I burned a large cotton-fiberglass sheet in an empty cargo vehicle: real-scale material fire spread.' },
  { id: 'saffire-ii', why: 'Saffire-II compared how cabin materials (silicone, PMMA, Nomex, fabric) burn in microgravity.' },
  { id: 'saffire-iii', why: 'Saffire-III repeated the large fabric burn at a faster airflow.' },
  { id: 'acme-cfi-g', why: 'ACME CFI-G burned gas fuels at oxygen fractions up to about 40%, well above normal air.' },
  { id: 'acme-bre', why: 'ACME BRE tested enriched crew atmospheres (up to 34-40% O2) and how material-like burning depends on oxygen.' },
];

const apollo13: InvestigationLink[] = [
  { id: 'acme-bre', why: 'ACME BRE looks at how burning depends on oxygen concentration, the closest PSI topic to a fire inside an oxygen system.' },
];

const mir: InvestigationLink[] = [
  { id: 'same', why: 'SAME measured smoke particles in microgravity to check that cabin smoke detectors still work.' },
  { id: 'same-r', why: 'SAME-R re-flew the smoke tests with more materials and conditions.' },
  { id: 'flex', why: 'FLEX studied how fuel droplet fires are put out in microgravity (suppression).' },
  { id: 'flex-2', why: 'FLEX-2 extended the extinguishment work to fuel mixtures.' },
];

const artemis2: InvestigationLink[] = [
  { id: 'same', why: 'SAME is the PSI study of how smoke behaves in front of a detector in microgravity.' },
  { id: 'same-r', why: 'SAME-R widened that smoke-detection data set.' },
];

export const INCIDENTS: Incident[] = [
  {
    id: 'apollo-1',
    year: 1967,
    title: 'Apollo 1',
    summary:
      'During a ground test on the launch pad, a fire in the pure-oxygen cabin killed Grissom, White and Chaffee. It spread very quickly through combustible materials, and the hatch could not be opened in time.',
    failureMode: '100% oxygen cabin, flammable materials',
    links: apollo1,
    linkedInvestigationIds: ids(apollo1),
    sourceUrl: 'https://sma.nasa.gov/sma-disciplines/accllp/apollo-1',
    sourceLabel: 'NASA Safety & Mission Assurance: Apollo 1',
  },
  {
    id: 'apollo-13',
    year: 1970,
    title: 'Apollo 13',
    summary:
      'An oxygen tank exploded on the way to the Moon. Before launch, a pad test had overheated the tank heaters and damaged the Teflon insulation inside. The crew used the lunar module as a lifeboat and came home.',
    failureMode: 'Ignition inside an oxygen tank',
    links: apollo13,
    linkedInvestigationIds: ids(apollo13),
    sourceUrl: 'https://sma.nasa.gov/sma-disciplines/accllp/apollo-13',
    sourceLabel: 'NASA Safety & Mission Assurance: Apollo 13',
    scopeNote: 'Tank and propellant explosions are mostly outside the PSI combustion data.',
  },
  {
    id: 'mir',
    year: 1997,
    title: 'Mir',
    summary:
      'An oxygen-generating canister caught fire with six people aboard. The crew put on masks and fought it with extinguishers; dense smoke filled the station and took hours to clear.',
    failureMode: 'Oxygen generator fire, smoke, suppression',
    links: mir,
    linkedInvestigationIds: ids(mir),
    sourceUrl: 'https://www.nasa.gov/history/25-years-ago-fire-aboard-space-station-mir/',
    sourceLabel: 'NASA History: Fire aboard Mir',
  },
  {
    id: 'artemis-2',
    year: 2026,
    title: 'Artemis II',
    summary: "The Orion crew's fire alarm went off deep in space. Knowing whether it is really smoke still matters.",
    failureMode: 'Fire detection and alarms',
    quote: {
      text: "make the fire alarm go off in your spacecraft when you're still about 80,000 miles from home",
      by: 'Artemis II commander',
    },
    links: artemis2,
    linkedInvestigationIds: ids(artemis2),
    sourceUrl: 'https://www.spaceappschallenge.org/',
    sourceLabel: 'NASA Space Apps 2026 challenge brief',
  },
];
