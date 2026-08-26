import { describe, expect, it } from "vitest";
import {
  compareRows,
  estimateCountBase,
  isDemoDataset,
  matchesFilters,
  matchesPlace,
  qualityPassesThreshold,
  statusLine,
} from "./filters";
import { AtlasManifest, CountryRecord, type Quality } from "./schema";

function country(
  overrides: Partial<CountryRecord> & Pick<CountryRecord, "iso3" | "name">,
): CountryRecord {
  const status = overrides.status ?? "ok";
  const quality =
    status === "ok" ? (overrides.quality ?? "C") : (overrides.quality ?? null);
  const pHat =
    status === "ok" ? (overrides.p_hat ?? 0.02275) : (overrides.p_hat ?? null);
  return CountryRecord.parse(
    Object.assign(
      {
        continent: "Americas",
        region_m49: "Northern America",
        mu: status === "ok" ? 100 : null,
        sigma: status === "ok" ? 15 : null,
        sigma_source: status === "ok" ? "assumed_15" : null,
        sigma_flag: null,
        mu_se: null,
        p_lo_pm3: pHat,
        p_hi_pm3: pHat,
        p_lo_se: null,
        p_hi_se: null,
        population: 1_000_000,
        pop_year: 2025,
        estimated_n_ge_130: pHat == null ? null : 22_750,
        source: status === "ok" ? "DEMO" : null,
        source_short: status === "ok" ? "DEMO" : null,
        source_url: null,
        source_year: status === "ok" ? 2026 : null,
        sample_n: status === "ok" ? 1 : null,
        sample_type: status === "ok" ? "convenience" : null,
        notes: null,
        has_geometry: false,
        tiny_population: false,
      },
      overrides,
      { quality, p_hat: pHat, status },
    ),
  );
}

const usa = country({ iso3: "USA", name: "United States" });
const nga = country({
  iso3: "NGA",
  name: "Nigeria",
  continent: "Africa",
  region_m49: "Western Africa",
});
const ken = country({
  iso3: "KEN",
  name: "Kenya",
  continent: "Africa",
  region_m49: "Eastern Africa",
});
const nru = country({
  iso3: "NRU",
  name: "Nauru",
  continent: "Oceania",
  region_m49: "Micronesia",
  population: 12_025,
  tiny_population: true,
});

describe("matchesPlace", () => {
  it("ANDs continent and region; empty lists are unconstrained", () => {
    expect(matchesPlace(nga, [], [])).toBe(true);
    expect(matchesPlace(nga, ["Africa"], [])).toBe(true);
    expect(matchesPlace(nga, ["Africa"], ["Eastern Africa"])).toBe(false);
    expect(matchesPlace(ken, ["Africa"], ["Eastern Africa"])).toBe(true);
    expect(matchesPlace(ken, ["Asia"], ["Eastern Africa"])).toBe(false);
    expect(matchesPlace(usa, ["Africa"], [])).toBe(false);
  });

  it("does not treat a continent name as a region_m49 match", () => {
    expect(matchesPlace(nga, [], ["Africa"])).toBe(false);
    expect(matchesPlace(nga, [], ["Western Africa"])).toBe(true);
  });
});

describe("qualityPassesThreshold", () => {
  it("includes U at C and excludes D and E", () => {
    expect(qualityPassesThreshold("A", "C")).toBe(true);
    expect(qualityPassesThreshold("B", "C")).toBe(true);
    expect(qualityPassesThreshold("C", "C")).toBe(true);
    expect(qualityPassesThreshold("U", "C")).toBe(true);
    expect(qualityPassesThreshold("D", "C")).toBe(false);
    expect(qualityPassesThreshold("E", "C")).toBe(false);
    expect(qualityPassesThreshold(null, "C")).toBe(false);
  });

  it("never includes E even at threshold D; U is still excluded at A", () => {
    expect(qualityPassesThreshold("E", "D")).toBe(false);
    expect(qualityPassesThreshold("D", "D")).toBe(true);
    expect(qualityPassesThreshold("U", "D")).toBe(true);
    expect(qualityPassesThreshold("U", "A")).toBe(false);
    expect(qualityPassesThreshold("A", "A")).toBe(true);
  });
});

describe("matchesFilters", () => {
  const defaults = {
    continents: [] as string[],
    regions: [] as string[],
    minPop: 250_000,
    quality: "C" as const,
  };

  it("requires status ok, quality, min population, and place", () => {
    expect(matchesFilters(usa, defaults)).toBe(true);
    expect(matchesFilters(nru, defaults)).toBe(false);
    expect(
      matchesFilters(
        country({ iso3: "AFG", name: "Afghanistan", status: "no_estimate" }),
        defaults,
      ),
    ).toBe(false);
  });

  it("drops quality E from the table set", () => {
    const extreme = country({
      iso3: "XXX",
      name: "Extreme",
      quality: "E" as Quality,
    });
    expect(matchesFilters(extreme, defaults)).toBe(false);
    expect(matchesFilters(extreme, { ...defaults, quality: "D" })).toBe(false);
    expect(estimateCountBase(extreme)).toBe(false);
  });

  it("includes U at default C", () => {
    const unknown = country({ iso3: "UNK", name: "Unknown", quality: "U" });
    expect(matchesFilters(unknown, defaults)).toBe(true);
  });

  it("excludes null population from min-pop", () => {
    const noPop = country({ iso3: "TWN", name: "Taiwan", population: null });
    expect(matchesFilters(noPop, defaults)).toBe(false);
  });
});

describe("statusLine", () => {
  it("omits E from the with-estimates count", () => {
    const rows = [
      usa,
      country({ iso3: "XXX", name: "Extreme", quality: "E" as Quality }),
      country({ iso3: "AFG", name: "Afghanistan", status: "no_estimate" }),
      nru,
    ];
    const shown = [usa];
    expect(statusLine(rows, shown)).toBe(
      "Showing 1 of 2 countries with estimates; 1 no estimate; 1 hidden by filters.",
    );
  });
});

describe("compareRows", () => {
  it("defaults to population descending", () => {
    const big = country({
      iso3: "IND",
      name: "India",
      population: 1_400_000_000,
    });
    const small = country({
      iso3: "URY",
      name: "Uruguay",
      population: 3_000_000,
    });
    expect(compareRows(big, small, "population")).toBeLessThan(0);
    expect(compareRows(small, usa, "name")).toBeGreaterThan(0);
  });
});

describe("isDemoDataset", () => {
  const base = AtlasManifest.parse({
    schema_version: 1,
    dataset_id: "demo-quality-c",
    created_at: "2026-08-26T00:00:00Z",
    pipeline_version: "0.0.0",
    threshold_iq: 130,
    default_sigma: 15,
    formula: "p = 1 - Phi((130 - mu) / sigma)",
    phi_implementation: "scipy.stats.norm.sf",
    metric_label: "Estimated share modeled at IQ ≥ 130",
    population_source: "UN WPP",
    geometry_source: "none",
    estimates_source: {
      name: "DEMO_FIXTURE",
      citation: null,
      url: null,
      license: null,
    },
    caveats_hash: "abc",
    n_ok: 1,
    n_no_estimate: 0,
    n_no_iso: 0,
    n_excluded_territory: 0,
    n_unmatched: 0,
    n_quality: { A: 0, B: 0, C: 1, D: 0, E: 0, U: 0 },
    flags: {
      show_continuous_scale: false,
      allow_quality_d: false,
      demo_badge: true,
    },
    assumptions: ["test"],
  });

  it("keys off demo_badge or a demo- dataset_id prefix", () => {
    expect(isDemoDataset(base)).toBe(true);
    expect(
      isDemoDataset({
        ...base,
        flags: { ...base.flags, demo_badge: false },
        dataset_id: "demo-other",
      }),
    ).toBe(true);
    expect(
      isDemoDataset({
        ...base,
        flags: { ...base.flags, demo_badge: false },
        dataset_id: "user-csv",
      }),
    ).toBe(false);
  });
});
