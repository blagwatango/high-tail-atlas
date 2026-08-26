import { z } from "zod";

export const Quality = z.enum(["A", "B", "C", "D", "E", "U"]);
export type Quality = z.infer<typeof Quality>;

export const SampleType = z.enum([
  "adult_representative",
  "students",
  "children",
  "urban",
  "clinical",
  "convenience",
  "imputed",
  "unknown",
]);
export type SampleType = z.infer<typeof SampleType>;

/** CSV empty cells arrive as `""`; treat them as omitted. */
const emptyToUndef = z.literal("").transform(() => undefined);

const unitInterval = z.number().min(0).max(1).nullable();

const QualityCounts = z
  .object({
    A: z.number().int(),
    B: z.number().int(),
    C: z.number().int(),
    D: z.number().int(),
    E: z.number().int(),
    U: z.number().int(),
  })
  .strict();

export const EstimateRow = z
  .object({
    iso3: z.string().length(3).regex(/^[A-Z]{3}$/).optional(),
    name: z.string().min(1).optional(),
    mu: z.number().gt(50).lt(130),
    sigma: z.number().gt(5).lt(30).optional(),
    mu_se: z.number().nonnegative().optional(),
    source: z.string().optional(),
    source_url: z.string().url().optional().or(emptyToUndef),
    source_year: z.number().int().gte(1900).lte(2026).optional(),
    sample_n: z.number().int().positive().optional(),
    sample_type: SampleType.optional(),
    quality: Quality.optional(),
    notes: z.union([emptyToUndef, z.string()]).optional(),
  })
  .refine((r) => r.iso3 || r.name, { message: "iso3 or name required" });
export type EstimateRow = z.infer<typeof EstimateRow>;

export const CountryRecord = z
  .object({
    iso3: z.string().regex(/^[A-Z0-9]{3}$/),
    name: z.string(),
    continent: z.string().nullable(),
    region_m49: z.string().nullable(),
    mu: z.number().nullable(),
    sigma: z.number().nullable(),
    sigma_source: z.enum(["source", "assumed_15"]).nullable(),
    sigma_flag: z.enum(["outside_12_20"]).nullable(),
    mu_se: z.number().nullable(),
    p_hat: unitInterval,
    p_lo_pm3: unitInterval,
    p_hi_pm3: unitInterval,
    p_lo_se: unitInterval,
    p_hi_se: unitInterval,
    population: z.number().int().nonnegative().nullable(),
    pop_year: z.number().int().nullable(),
    estimated_n_ge_130: z.number().int().nonnegative().nullable(),
    quality: Quality.nullable(),
    source: z.string().nullable(),
    source_short: z.string().nullable(),
    source_url: z.string().nullable(),
    source_year: z.number().int().nullable(),
    sample_n: z.number().int().nullable(),
    sample_type: SampleType.nullable(),
    notes: z.string().nullable(),
    status: z.enum(["ok", "no_estimate", "no_iso", "excluded_territory"]),
    has_geometry: z.boolean(),
    tiny_population: z.boolean(),
  })
  .strict()
  .superRefine((r, ctx) => {
    if ((r.quality === null) !== (r.status !== "ok")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'quality is null iff status !== "ok"',
        path: ["quality"],
      });
    }
    if ((r.p_hat === null) !== (r.status !== "ok")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'p_hat is null iff status !== "ok"',
        path: ["p_hat"],
      });
    }
    const seMissing = r.mu_se === null;
    if ((r.p_lo_se === null) !== seMissing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "p_lo_se is null iff mu_se is null",
        path: ["p_lo_se"],
      });
    }
    if ((r.p_hi_se === null) !== seMissing) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "p_hi_se is null iff mu_se is null",
        path: ["p_hi_se"],
      });
    }
  });
export type CountryRecord = z.infer<typeof CountryRecord>;

export const UnmatchedEstimate = z
  .object({
    raw_name: z.string().nullable(),
    raw_iso3: z.string().nullable(),
    mu: z.number(),
    reason: z.enum([
      "unmapped_name",
      "invalid_iso3",
      "ambiguous_name",
      "never_map",
    ]),
  })
  .strict();
export type UnmatchedEstimate = z.infer<typeof UnmatchedEstimate>;

export const AtlasManifest = z
  .object({
    schema_version: z.literal(1),
    dataset_id: z.string(),
    created_at: z.string().datetime({ offset: true }),
    pipeline_version: z.string(),
    threshold_iq: z.literal(130),
    default_sigma: z.literal(15),
    formula: z.literal("p = 1 - Phi((130 - mu) / sigma)"),
    phi_implementation: z.literal("scipy.stats.norm.sf"),
    metric_label: z.string(),
    population_source: z.string(),
    geometry_source: z.string(),
    estimates_source: z
      .object({
        name: z.string(),
        citation: z.string().nullable(),
        url: z.string().nullable(),
        license: z.string().nullable(),
      })
      .strict(),
    caveats_hash: z.string(),
    n_ok: z.number().int(),
    n_no_estimate: z.number().int(),
    n_no_iso: z.number().int(),
    n_excluded_territory: z.number().int(),
    n_unmatched: z.number().int(),
    n_quality: QualityCounts,
    flags: z
      .object({
        show_continuous_scale: z.boolean(),
        allow_quality_d: z.boolean(),
        demo_badge: z.boolean(),
      })
      .strict(),
    assumptions: z.array(z.string()),
  })
  .strict();
export type AtlasManifest = z.infer<typeof AtlasManifest>;

export const AtlasFile = z
  .object({
    manifest: AtlasManifest,
    countries: z.array(CountryRecord),
    unmatched_estimates: z.array(UnmatchedEstimate),
  })
  .strict();
export type AtlasFile = z.infer<typeof AtlasFile>;
