import { formatPHat } from "./format";
import type { CountryRecord } from "./schema";

/** Filtered-view download. Do not name this file like a ranking. */
export const CSV_FILENAME = "high-tail-atlas-estimates.csv";

/**
 * Provenance export of the filtered table. `p_hat_display` is the quality-policy
 * string; `p_hat_proportion` is the raw [0, 1] value. No `p_hat_pct` float.
 */
export const CSV_COLUMNS = [
  "iso3",
  "name",
  "p_hat_display",
  "p_hat_proportion",
  "estimated_n_ge_130",
  "population",
  "pop_year",
  "quality",
  "source_year",
  "source",
  "source_short",
  "sigma",
  "sigma_source",
  "mu",
  "continent",
  "region_m49",
] as const;

export function csvHeaderComments(datasetId: string): string {
  return [
    `# Modeled estimates, not measurements. p = 1 - Phi((130-mu)/sigma). Dataset ${datasetId}.`,
    `# p_hat_display is a formatted string from the quality policy; p_hat_proportion is in [0,1].`,
  ].join("\n");
}

function csvCell(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function rowCells(row: CountryRecord): string[] {
  return [
    csvCell(row.iso3),
    csvCell(row.name),
    csvCell(formatPHat(row.p_hat, row.quality, "table")),
    csvCell(row.p_hat),
    csvCell(row.estimated_n_ge_130),
    csvCell(row.population),
    csvCell(row.pop_year),
    csvCell(row.quality),
    csvCell(row.source_year),
    csvCell(row.source),
    csvCell(row.source_short),
    csvCell(row.sigma),
    csvCell(row.sigma_source),
    csvCell(row.mu),
    csvCell(row.continent),
    csvCell(row.region_m49),
  ];
}

export function buildEstimatesCsv(
  rows: CountryRecord[],
  datasetId: string,
): string {
  const lines = [
    csvHeaderComments(datasetId),
    CSV_COLUMNS.join(","),
    ...rows.map((row) => rowCells(row).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}
