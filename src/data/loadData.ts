import { DatasetSchema, type Dataset } from './schema';

/** Validates raw JSON as a Dataset; throws an Error listing each failing path. */
export function loadDataset(raw: unknown): Dataset {
  const result = DatasetSchema.safeParse(raw);
  if (result.success) return result.data;
  const lines = result.error.issues.map((issue) => {
    const path = issue.path.length
      ? issue.path.map(String).join('.')
      : '(root)';
    return `  ${path}: ${issue.message}`;
  });
  throw new Error(`Invalid dataset:\n${lines.join('\n')}`);
}
