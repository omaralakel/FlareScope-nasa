import raw from './investigations.json';
import { loadDataset } from './loadData';
import type { Dataset } from './schema';

/** The curated FlameScope dataset, validated once at module load. */
export const dataset: Dataset = loadDataset(raw);
