import { z } from 'zod';

export const ConfidenceSchema = z.enum(['stated', 'derived', 'missing']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export type Sourced<T> = {
  value: T | null;
  source: string | null;
  confidence: Confidence;
};

/** Builds a Sourced<T> schema enforcing the confidence/value/source rules. */
export function sourcedSchema<S extends z.ZodTypeAny>(valueSchema: S) {
  const schema = z
    .object({
      value: valueSchema.nullable(),
      source: z.string().min(1).nullable(),
      confidence: ConfidenceSchema,
    })
    .superRefine((raw, ctx) => {
      const v = raw as { value: unknown; source: string | null; confidence: Confidence };
      if (v.confidence === 'missing') {
        if (v.value !== null) {
          ctx.addIssue({
            code: 'custom',
            path: ['value'],
            message: "confidence 'missing' requires value to be null",
          });
        }
      } else {
        if (v.value === null) {
          ctx.addIssue({
            code: 'custom',
            path: ['value'],
            message: `confidence '${v.confidence}' requires a non-null value`,
          });
        }
        if (v.source === null) {
          ctx.addIssue({
            code: 'custom',
            path: ['source'],
            message: `confidence '${v.confidence}' requires a non-null source`,
          });
        }
      }
    });
  return schema as unknown as z.ZodType<Sourced<z.infer<S>>>;
}

export const RangeSchema = z
  .object({ min: z.number(), max: z.number() })
  .refine((r) => r.min <= r.max, { message: 'min must be <= max' });
export type Range = { min: number; max: number };

const percentRangeSchema = z
  .object({ min: z.number().min(0).max(100), max: z.number().min(0).max(100) })
  .refine((r) => r.min <= r.max, { message: 'min must be <= max' });

export const PillarSchema = z.enum(['prevention', 'detection', 'suppression']);
export type Pillar = z.infer<typeof PillarSchema>;

export const InvestigationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  years: z.string(),
  platform: z.string(),
  hardware: z.string(),
  fuelPhase: z.enum(['solid', 'liquid', 'gas', 'aerosol']),
  fuels: z.array(z.string()),
  sampleGeometry: sourcedSchema(z.string()),
  o2Percent: sourcedSchema(percentRangeSchema),
  pressurePsi: sourcedSchema(RangeSchema),
  flowCmS: sourcedSchema(RangeSchema),
  diluents: z.array(z.string()),
  varied: z.array(z.string()),
  fixed: z.array(z.string()),
  sensors: z.array(z.string()),
  findings: z.array(z.object({ text: z.string(), source: z.string() })),
  pillars: z.array(PillarSchema),
  psiUrl: z.string().nullable(),
  summary: z.string(),
});
export type Investigation = z.infer<typeof InvestigationSchema>;

export const TestPointSchema = z.object({
  investigationId: z.string().min(1),
  o2Percent: z.number().min(0).max(100),
  pressurePsi: z.number().nullable(),
  flowCmS: z.number().nullable(),
  fuel: z.string(),
  outcome: z.enum(['burned', 'extinguished', 'no_ignition', 'measured']),
  measured: z
    .object({ name: z.string(), value: z.number(), unit: z.string() })
    .optional(),
  source: z.string().min(1),
});
export type TestPoint = z.infer<typeof TestPointSchema>;

export const DatasetSchema = z
  .object({
    investigations: z.array(InvestigationSchema),
    tests: z.array(TestPointSchema),
    generatedAt: z.string(),
  })
  .superRefine((d, ctx) => {
    const seen = new Set<string>();
    d.investigations.forEach((inv, i) => {
      if (seen.has(inv.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['investigations', i, 'id'],
          message: `duplicate investigation id '${inv.id}'`,
        });
      }
      seen.add(inv.id);
    });
    d.tests.forEach((t, i) => {
      if (!seen.has(t.investigationId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['tests', i, 'investigationId'],
          message: `unknown investigationId '${t.investigationId}'`,
        });
      }
    });
  });
export type Dataset = z.infer<typeof DatasetSchema>;
