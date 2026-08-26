import {
  parseAsArrayOf,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";
import {
  DEFAULT_MIN_POPULATION,
  QUALITY_THRESHOLDS,
  SORT_KEYS,
} from "./filters";

/**
 * Shared dashboard query keys. Sort is the same param the lollipop and table
 * will read. Defaults: population desc, minPop 250k, quality C.
 */
export const dashboardParsers = {
  continent: parseAsArrayOf(parseAsString).withDefault([]),
  region: parseAsArrayOf(parseAsString).withDefault([]),
  minPop: parseAsInteger.withDefault(DEFAULT_MIN_POPULATION),
  quality: parseAsStringLiteral(QUALITY_THRESHOLDS).withDefault("C"),
  sort: parseAsStringLiteral(SORT_KEYS).withDefault("population"),
};
