import type { AtlasManifest, CountryRecord, Quality } from "./schema";

export const DEFAULT_MIN_POPULATION = 250_000;

export const QUALITY_THRESHOLDS = ["A", "B", "C", "D"] as const;
export type QualityThreshold = (typeof QUALITY_THRESHOLDS)[number];

export const SORT_KEYS = ["population", "p_hat", "name"] as const;
export type SortKey = (typeof SORT_KEYS)[number];

export const MIN_POP_PRESETS = [
  { value: 0, label: "0" },
  { value: 250_000, label: "250k" },
  { value: 1_000_000, label: "1M" },
  { value: 10_000_000, label: "10M" },
] as const;

/** Inclusive ceiling on A≻B≻C≻D. U ≡ C. E is never included. */
const INCLUDED_BY_THRESHOLD: Record<QualityThreshold, readonly Quality[]> = {
  A: ["A"],
  B: ["A", "B"],
  C: ["A", "B", "C", "U"],
  D: ["A", "B", "C", "U", "D"],
};

export function matchesPlace(
  row: CountryRecord,
  continents: string[],
  regions: string[],
): boolean {
  const continentOk =
    continents.length === 0 ||
    (row.continent != null && continents.includes(row.continent));
  const regionOk =
    regions.length === 0 ||
    (row.region_m49 != null && regions.includes(row.region_m49));
  return continentOk && regionOk;
}

export function qualityPassesThreshold(
  quality: Quality | null,
  threshold: QualityThreshold,
): boolean {
  if (quality == null || quality === "E") return false;
  return INCLUDED_BY_THRESHOLD[threshold].includes(quality);
}

export function matchesMinPopulation(
  row: CountryRecord,
  minPop: number,
): boolean {
  if (row.population == null) return false;
  return row.population >= minPop;
}

export type DashboardFilters = {
  continents: string[];
  regions: string[];
  minPop: number;
  quality: QualityThreshold;
};

/**
 * Rows that color the map / fill the table under current filters.
 * Quality E is always excluded. Null population fails min-pop.
 */
export function matchesFilters(
  row: CountryRecord,
  filters: DashboardFilters,
): boolean {
  if (row.status !== "ok") return false;
  if (!qualityPassesThreshold(row.quality, filters.quality)) return false;
  if (!matchesMinPopulation(row, filters.minPop)) return false;
  return matchesPlace(row, filters.continents, filters.regions);
}

export function compareRows(
  a: CountryRecord,
  b: CountryRecord,
  sort: SortKey,
): number {
  switch (sort) {
    case "population":
      return (b.population ?? -1) - (a.population ?? -1);
    case "p_hat":
      return (
        (b.p_hat ?? Number.NEGATIVE_INFINITY) -
        (a.p_hat ?? Number.NEGATIVE_INFINITY)
      );
    case "name":
      return a.name.localeCompare(b.name);
  }
}

/** E is omitted from table counts; U is included at threshold C. */
export function estimateCountBase(row: CountryRecord): boolean {
  return row.status === "ok" && row.quality !== "E";
}

export function statusLine(
  countries: CountryRecord[],
  shown: CountryRecord[],
): string {
  const withEstimates = countries.filter(estimateCountBase).length;
  const showing = shown.filter(estimateCountBase).length;
  const noEstimate = countries.filter((c) => c.status !== "ok").length;
  const hidden = withEstimates - showing;
  return `Showing ${showing} of ${withEstimates} countries with estimates; ${noEstimate} no estimate; ${hidden} hidden by filters.`;
}

export function isDemoDataset(manifest: AtlasManifest): boolean {
  return manifest.flags.demo_badge || manifest.dataset_id.startsWith("demo-");
}

export function uniqueSorted(values: Iterable<string | null>): string[] {
  const set = new Set<string>();
  for (const v of values) {
    if (v != null && v !== "") set.add(v);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}
