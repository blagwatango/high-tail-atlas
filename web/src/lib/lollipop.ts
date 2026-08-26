import { binFill } from "./colors";
import type { CountryRecord, Quality } from "./schema";
import { pPct } from "./pct";

export const LOLLIPOP_CAP = 40;
export const LOLLIPOP_CAP_LABEL =
  "40 countries in current sort (default: largest populations).";
export const LOLLIPOP_AXIS_TITLE =
  "Estimated % of population modeled at IQ ≥ 130";
export const LOLLIPOP_TITLE = "Country comparison (lollipop)";

export type LollipopRow = CountryRecord & {
  p_pct: number;
  fill: ReturnType<typeof binFill>;
};

export function toLollipopRows(countries: CountryRecord[]): LollipopRow[] {
  const rows: LollipopRow[] = [];
  for (const country of countries) {
    if (country.p_hat == null) continue;
    rows.push({
      ...country,
      // Percent axis must bind p_pct, never the [0,1] proportion.
      p_pct: pPct(country.p_hat),
      fill: binFill(country.p_hat),
    });
  }
  return rows;
}

export function capLollipopRows(
  rows: LollipopRow[],
  showAll: boolean,
  cap = LOLLIPOP_CAP,
): LollipopRow[] {
  if (showAll || rows.length <= cap) return rows;
  return rows.slice(0, cap);
}

export function isHollowHead(quality: Quality | null): boolean {
  return quality === "C" || quality === "U";
}

export function isDottedStem(quality: Quality | null): boolean {
  return quality === "D";
}

export function showAllCountriesLabel(n: number): string {
  return `Show all ${n} countries.`;
}
