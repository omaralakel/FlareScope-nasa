export type HabitatId = 'iss' | 'moon' | 'rover' | 'mars' | 'suit';

export type Habitat = {
  id: HabitatId;
  label: string;
  o2Percent: number;
  pressurePsi: number;
  gravityG: number;
  assumed: boolean;
  note: string;
};

export const GRAVITY_PRESETS = { micro: 0, moon: 0.166, mars: 0.38, earth: 1 } as const;

export const HABITATS: Record<HabitatId, Habitat> = {
  iss: {
    id: 'iss',
    label: 'ISS cabin',
    o2Percent: 21,
    pressurePsi: 14.7,
    gravityG: GRAVITY_PRESETS.micro,
    assumed: false,
    note: 'Earth-like air: 21% O2 at 14.7 psi, microgravity.',
  },
  moon: {
    id: 'moon',
    label: 'Moon base',
    o2Percent: 30,
    pressurePsi: 10.2,
    gravityG: GRAVITY_PRESETS.moon,
    assumed: false,
    note: 'Exploration atmosphere: 30% O2 at 10.2 psi, lunar gravity.',
  },
  rover: {
    id: 'rover',
    label: 'Pressurized rover',
    o2Percent: 30,
    pressurePsi: 10.2,
    gravityG: GRAVITY_PRESETS.moon,
    assumed: false,
    note: 'Exploration atmosphere: 30% O2 at 10.2 psi, lunar gravity.',
  },
  mars: {
    id: 'mars',
    label: 'Mars habitat',
    o2Percent: 30,
    pressurePsi: 10.2,
    gravityG: GRAVITY_PRESETS.mars,
    assumed: true,
    note: 'assumed, not specified by NASA. Uses the Moon base atmosphere with Mars gravity.',
  },
  suit: {
    id: 'suit',
    label: 'Spacesuit',
    o2Percent: 100,
    pressurePsi: 4.3,
    gravityG: GRAVITY_PRESETS.micro,
    assumed: false,
    note: 'Pure O2 at 4.3 psi. Gravity is 0 because the suit is used for EVA in microgravity (ISS context).',
  },
};
