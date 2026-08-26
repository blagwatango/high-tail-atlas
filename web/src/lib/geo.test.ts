import { describe, expect, it } from "vitest";
import { CountryRecord } from "./schema";
import { joinIso3, mapTooltipText } from "./geo";

describe("joinIso3", () => {
  it("prefers ISO_A3 when it is a usable three-letter code", () => {
    expect(joinIso3({ ISO_A3: "usa", ADM0_A3: "USA" })).toBe("USA");
  });

  it("uses ADM0_A3 when ISO_A3 is -99", () => {
    expect(joinIso3({ ISO_A3: "-99", ADM0_A3: "CYN" })).toBe("CYN");
  });

  it("aliases NE Kosovo KOS to XKX", () => {
    expect(joinIso3({ ISO_A3: "-99", ADM0_A3: "KOS" })).toBe("XKX");
  });

  it("returns null when neither code is usable", () => {
    expect(joinIso3({ ISO_A3: "-99", ADM0_A3: "" })).toBeNull();
  });
});

function row(
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
        source: status === "ok" ? "DEMO_FIXTURE" : null,
        source_short: status === "ok" ? "DEMO" : null,
        source_url: null,
        source_year: status === "ok" ? 2026 : null,
        sample_n: status === "ok" ? 1 : null,
        sample_type: status === "ok" ? "convenience" : null,
        notes: null,
        has_geometry: true,
        tiny_population: false,
      },
      overrides,
      { quality, p_hat: pHat, status },
    ),
  );
}

describe("mapTooltipText", () => {
  it("uses the required modeled-estimate copy", () => {
    const text = mapTooltipText(row({ iso3: "USA", name: "United States" }));
    expect(text).toContain("United States");
    expect(text).toContain("Estimated share modeled at IQ ≥ 130: ~2%");
    expect(text).toContain("This is a model output, not a count.");
    expect(text).toContain("Quality: C · Source year: 2026");
    expect(text).toContain("Source: DEMO");
    expect(text).toContain("low sample quality");
  });

  it("labels no-estimate rows without inventing a share", () => {
    const text = mapTooltipText(
      row({ iso3: "AFG", name: "Afghanistan", status: "no_estimate" }),
    );
    expect(text).toContain("Estimated share modeled at IQ ≥ 130: No estimate");
    expect(text).toContain("Quality: no estimate");
    expect(text).toContain("Not independently estimated");
  });
});
