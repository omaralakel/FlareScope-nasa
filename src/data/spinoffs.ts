/**
 * NASA fire-safety technology that reached Earth, for the "Back on Earth" section.
 * Summaries are our own short wording of the linked source page.
 */
import type { InvestigationLink } from './incidents';

export type Spinoff = {
  id: string;
  title: string;
  /** Year of the source story, when the source states it. */
  year?: number;
  summary: string;
  links: InvestigationLink[];
  linkedInvestigationIds: string[];
  sourceUrl: string;
  sourceLabel: string;
};

const ids = (links: InvestigationLink[]) => links.map((l) => l.id);

const smoke: InvestigationLink[] = [
  { id: 'same', why: 'SAME measured smoke from spacecraft materials to check that detectors alarm correctly in microgravity.' },
  { id: 'same-r', why: 'SAME-R extended those smoke measurements to more materials and heating conditions.' },
];

const mist: InvestigationLink[] = [
  { id: 'flex', why: 'FLEX measured how flames go out in microgravity, including with suppressant gases.' },
  { id: 'flex-2', why: 'FLEX-2 extended the extinction-limit data to fuel mixtures.' },
  { id: 'bass', why: 'BASS includes suppression of burning solids with nitrogen in microgravity.' },
];

const daft: InvestigationLink[] = [
  { id: 'same', why: 'SAME is the smoke experiment DAFT was flown to support; it relies on the same particle counter.' },
  { id: 'same-r', why: 'SAME-R re-flew the SAME smoke hardware.' },
];

export const SPINOFFS: Spinoff[] = [
  {
    id: 'air-tanks',
    title: "Firefighters' air tanks",
    year: 1976,
    summary:
      'Built with NASA Johnson, a lighter breathing pack for firefighters: about 30 minutes of air at roughly 20 lb, using a composite-wrapped aluminum tank, a clearer mask and a low-air warning only the wearer hears.',
    links: [],
    linkedInvestigationIds: [],
    sourceUrl: 'https://spinoff.nasa.gov/node/9582',
    sourceLabel: "NASA Spinoff: Fireman's Air Tanks",
  },
  {
    id: 'smoke-detector',
    title: 'A detector that tells smoke from dust',
    year: 1978,
    summary:
      'A fire detector first flown on the Space Shuttle samples the air and tells combustion particles from dust, so it raises fewer false alarms. Linked sensors can watch large sites such as mines.',
    links: smoke,
    linkedInvestigationIds: ids(smoke),
    sourceUrl: 'https://spinoff.nasa.gov/node/9407',
    sourceLabel: 'NASA Spinoff: Fire Detector',
  },
  {
    id: 'fire-attire',
    title: 'Fire attire',
    year: 1982,
    summary:
      'Project FIRES, run by NASA Marshall with the U.S. Fire Administration, used light, heat-resistant materials from Apollo suits and thermal protection to redesign firefighter gear, tested with fourteen city fire departments.',
    links: [],
    linkedInvestigationIds: [],
    sourceUrl: 'https://spinoff.nasa.gov/node/9918',
    sourceLabel: 'NASA Spinoff: New Technology for the Fire Attire',
  },
  {
    id: 'water-mist',
    title: 'Water-mist extinguishers',
    year: 2020,
    summary:
      'Nine fine-water-mist extinguishers replaced the CO2 units on the Space Station, the last arriving in 2016. The zero-leak valve made for them now seals grease dispensers, hydraulic systems and munitions trailers on Earth.',
    links: mist,
    linkedInvestigationIds: ids(mist),
    sourceUrl: 'https://spinoff.nasa.gov/Spinoff2020/ip_5.html',
    sourceLabel: 'NASA Spinoff 2020: Zero-leak valve',
  },
];

/** SAME and DAFT: one particle-counter story connecting smoke and dust. */
export const SAME_DAFT: Spinoff = {
  id: 'same-daft',
  title: 'SAME and DAFT: smoke versus dust',
  year: 2005,
  summary:
    'To trust smoke readings in orbit, NASA Glenn first flew DAFT, a dust and aerosol test of the handheld particle counter that SAME depends on. DAFT is not in the PSI repository; SAME and SAME-R are.',
  links: daft,
  linkedInvestigationIds: ids(daft),
  sourceUrl: 'https://ntrs.nasa.gov/citations/20050215648',
  sourceLabel: 'NASA Technical Reports Server (2005)',
};
