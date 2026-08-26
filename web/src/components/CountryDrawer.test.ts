import { describe, expect, it } from "vitest";
import { CountryRecord } from "@/lib/schema";
import {
  WHAT_THIS_IS_NOT,
  drawerPrimaryBand,
  drawerShowsPm3Disclosure,
  formatBandRange,
} from "./CountryDrawer";
import { formulaDisplay } from "./FormulaBlock";

function country(
  overrides: Partial<CountryRecord> & Pick<CountryRecord, "iso3" | "name">,
): CountryRecord {
  const status = overrides.status ?? "ok";
  const quality =
    status === "ok" ? (overrides.quality ?? "C") : (overrides.quality ?? null);
  const pHat =
    status === "ok"
      ? (overrides.p_hat ?? 0.022750131948179195)
      : (overrides.p_hat ?? null);
  const muSe = overrides.mu_se ?? null;
  const hasSe = muSe != null;
  return CountryRecord.parse(
    Object.assign(
      {
        continent: "Americas",
        region_m49: "Northern America",
        mu: status === "ok" ? 100 : null,
        sigma: status === "ok" ? 15 : null,
        sigma_source: status === "ok" ? "assumed_15" : null,
        sigma_flag: null,
        mu_se: muSe,
        p_lo_pm3: pHat == null ? null : 0.01390344751349861,
        p_hi_pm3: pHat == null ? null : 0.03593031911292581,
        p_lo_se: hasSe ? (overrides.p_lo_se ?? 0.01) : null,
        p_hi_se: hasSe ? (overrides.p_hi_se ?? 0.04) : null,
        population: 1_000_000,
        pop_year: 2025,
        estimated_n_ge_130: pHat == null ? null : 22_750,
        source: status === "ok" ? "DEMO_FIXTURE" : null,
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
      { quality, p_hat: pHat, status, mu_se: muSe },
    ),
  );
}

describe("drawerPrimaryBand", () => {
  it("uses the SE band when p_lo_se is non-null", () => {
    const row = country({
      iso3: "USA",
      name: "United States",
      mu_se: 1,
      p_lo_se: 0.01,
      p_hi_se: 0.04,
    });
    const band = drawerPrimaryBand(row);
    expect(band).toEqual({ kind: "se", lo: 0.01, hi: 0.04 });
    expect(drawerShowsPm3Disclosure(row)).toBe(true);
  });

  it("uses only the ±3 band when p_lo_se is null", () => {
    const row = country({ iso3: "USA", name: "United States" });
    expect(row.p_lo_se).toBeNull();
    const band = drawerPrimaryBand(row);
    expect(band.kind).toBe("pm3");
    if (band.kind !== "pm3") throw new Error("expected pm3");
    expect(band.lo).toBe(row.p_lo_pm3);
    expect(band.hi).toBe(row.p_hi_pm3);
    expect(drawerShowsPm3Disclosure(row)).toBe(false);
  });

  it("has no band when there is no estimate", () => {
    const row = country({
      iso3: "TCD",
      name: "Chad",
      status: "no_estimate",
    });
    expect(drawerPrimaryBand(row)).toEqual({ kind: "none" });
    expect(drawerShowsPm3Disclosure(row)).toBe(false);
  });
});

describe("formatBandRange", () => {
  it("formats the documented ±3 band around μ=100, σ=15", () => {
    expect(formatBandRange(0.01390344751349861, 0.03593031911292581)).toBe(
      "1.39%–3.59%",
    );
  });
});

describe("WHAT_THIS_IS_NOT", () => {
  it("is two sentences: not a census, not a ranking of worth", () => {
    expect(WHAT_THIS_IS_NOT).toHaveLength(2);
    expect(WHAT_THIS_IS_NOT[0].toLowerCase()).toContain("not a census");
    expect(WHAT_THIS_IS_NOT[1].toLowerCase()).toContain("not a ranking");
    expect(WHAT_THIS_IS_NOT[1].toLowerCase()).toContain("worth");
    const joined = WHAT_THIS_IS_NOT.join(" ").toLowerCase();
    expect(joined).not.toContain("leaderboard");
    expect(joined).not.toContain("iq rankings");
    expect(joined).not.toContain("smartest country");
    expect(joined).not.toContain("dumbest country");
    expect(joined).not.toContain("national intelligence");
  });
});

describe("drawer formula uses this country", () => {
  it("matches formulaDisplay for the row's μ and σ", () => {
    const row = country({ iso3: "USA", name: "United States", mu: 100, sigma: 15 });
    expect(row.mu).toBe(100);
    expect(row.sigma).toBe(15);
    expect(formulaDisplay(row.mu!, row.sigma!)).toBe(
      "1 − Φ((130 − 100) / 15) = 2.28%",
    );
  });
});
