/** Proportion; axis / bin math. Quality-A cells of this value format as `2.3%`. */
export const REFERENCE_P = 0.02275;
/** Legend, reference-line label, methodology. Never write `2.275%` in the UI. */
export const REFERENCE_P_LABEL = "2.28%";

/** No-data fill (no estimate / no ISO / excluded). Pair with hatch on the map. */
export const COLOR_NO_DATA = "#d1d5db";
/** Filtered-out fill (fails min-pop or quality). No hatch. */
export const COLOR_FILTERED = "#e5e7eb";
/** 1px swatch border; not a data color. */
export const COLOR_SWATCH_BORDER = "#6b7280";

/**
 * Fixed percentage bins of p_hat (proportion in [0, 1]).
 * Lightest ColorBrewer BuPu `#edf8fb` is unused — too low-contrast on white.
 */
export const P_BINS = [
  { maxExclusive: 0.005, fill: "#bfd3e6", label: "< 0.5%" },
  { maxExclusive: 0.015, fill: "#9ebcda", label: "0.5–1.5%" },
  { maxExclusive: 0.025, fill: "#8c96c6", label: "1.5–2.5%" },
  { maxExclusive: 0.045, fill: "#8856a7", label: "2.5–4.5%" },
  { maxExclusive: Infinity, fill: "#810f7c", label: "≥ 4.5%" },
] as const;

export type DataBinFill =
  | "#bfd3e6"
  | "#9ebcda"
  | "#8c96c6"
  | "#8856a7"
  | "#810f7c";

/** Data-bin fill for a modeled proportion. Null is no-data gray. */
export function binFill(pHat: number | null): DataBinFill | typeof COLOR_NO_DATA {
  if (pHat == null) return COLOR_NO_DATA;
  for (const bin of P_BINS) {
    if (pHat < bin.maxExclusive) return bin.fill;
  }
  return P_BINS[P_BINS.length - 1].fill;
}

export function choroplethFill(opts: {
  pHat: number | null;
  status: "ok" | "no_estimate" | "no_iso" | "excluded_territory";
  filteredOut: boolean;
}): string {
  // Status first: no_estimate / no_iso / excluded_territory are no-data,
  // even if the caller passed filteredOut because matchesFilters is false.
  if (opts.status !== "ok" || opts.pHat == null) return COLOR_NO_DATA;
  if (opts.filteredOut) return COLOR_FILTERED;
  return binFill(opts.pHat);
}

export type ChoroplethFillKind = "bin" | "no-data" | "filtered";

export function choroplethFillKind(opts: {
  pHat: number | null;
  status: "ok" | "no_estimate" | "no_iso" | "excluded_territory";
  filteredOut: boolean;
}): ChoroplethFillKind {
  if (opts.status !== "ok" || opts.pHat == null) return "no-data";
  if (opts.filteredOut) return "filtered";
  return "bin";
}

/** Overlay hatch. Filtered-out and A/B have none. */
export type ChoroplethHatch = "none" | "no-data" | "sparse";

export function choroplethHatch(opts: {
  status: "ok" | "no_estimate" | "no_iso" | "excluded_territory";
  quality: "A" | "B" | "C" | "D" | "E" | "U" | null;
  filteredOut: boolean;
}): ChoroplethHatch {
  if (opts.status !== "ok") return "no-data";
  if (opts.filteredOut) return "none";
  if (opts.quality === "C" || opts.quality === "U") return "sparse";
  return "none";
}
