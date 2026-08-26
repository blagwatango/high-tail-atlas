import { describe, expect, it } from "vitest";
import { REFERENCE_P } from "./colors";
import { pPct } from "./pct";
import { CountryRecord, type Quality } from "./schema";
import {
  capLollipopRows,
  isDottedStem,
  isHollowHead,
  LOLLIPOP_AXIS_TITLE,
  LOLLIPOP_CAP,
  LOLLIPOP_CAP_LABEL,
  LOLLIPOP_TITLE,
  showAllCountriesLabel,
  toLollipopRows,
} from "./lollipop";

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

describe("lollipop copy", () => {
  it("uses the comparison title and cap label, not ranking chrome", () => {
    expect(LOLLIPOP_TITLE).toBe("Country comparison (lollipop)");
    expect(LOLLIPOP_CAP_LABEL).toBe(
      "40 countries in current sort (default: largest populations).",
    );
    expect(LOLLIPOP_AXIS_TITLE).toBe(
      "Estimated % of population modeled at IQ ≥ 130",
    );
    expect(LOLLIPOP_CAP_LABEL.toLowerCase()).not.toContain("top 40");
    expect(LOLLIPOP_TITLE.toLowerCase()).not.toContain("ranked");
    expect(showAllCountriesLabel(87)).toBe("Show all 87 countries.");
  });
});

describe("toLollipopRows", () => {
  it("binds p_pct via pPct and never the raw proportion", () => {
    const usa = country({
      iso3: "USA",
      name: "United States",
      p_hat: REFERENCE_P,
      quality: "A",
    });
    const [row] = toLollipopRows([usa]);
    expect(row?.p_pct).toBe(pPct(REFERENCE_P));
    expect(row?.p_pct).toBe(2.275);
    expect(row?.p_pct).not.toBe(usa.p_hat);
    expect(row?.fill).toBe("#8c96c6");
  });

  it("omits rows without p_hat", () => {
    const missing = country({
      iso3: "ATA",
      name: "Antarctica",
      status: "no_estimate",
    });
    const ok = country({ iso3: "USA", name: "United States" });
    expect(toLollipopRows([missing, ok])).toHaveLength(1);
    expect(toLollipopRows([missing, ok])[0]?.iso3).toBe("USA");
  });

  it("uses map bins for 90/100/110 demo means", () => {
    const low = country({ iso3: "CHN", name: "China", p_hat: 0.00383 });
    const mid = country({ iso3: "USA", name: "United States", p_hat: 0.02275 });
    const high = country({ iso3: "IND", name: "India", p_hat: 0.0912 });
    const fills = toLollipopRows([low, mid, high]).map((r) => r.fill);
    expect(fills).toEqual(["#bfd3e6", "#8c96c6", "#810f7c"]);
  });
});

describe("capLollipopRows", () => {
  it("caps at 40 in the current sort unless show-all", () => {
    const many = Array.from({ length: 45 }, (_, i) =>
      country({
        iso3: `A${String(i).padStart(2, "0")}`,
        name: `Country ${i}`,
        population: 1_000_000 - i,
      }),
    );
    const rows = toLollipopRows(many);
    expect(LOLLIPOP_CAP).toBe(40);
    expect(capLollipopRows(rows, false)).toHaveLength(40);
    expect(capLollipopRows(rows, false)[0]?.iso3).toBe("A00");
    expect(capLollipopRows(rows, true)).toHaveLength(45);
    expect(capLollipopRows(rows.slice(0, 12), false)).toHaveLength(12);
  });
});

describe("lollipop marks", () => {
  it("uses hollow heads for C and U, dotted stems only for D", () => {
    const marks: Quality[] = ["A", "B", "C", "D", "U"];
    expect(marks.filter(isHollowHead)).toEqual(["C", "U"]);
    expect(marks.filter(isDottedStem)).toEqual(["D"]);
    expect(isHollowHead(null)).toBe(false);
    expect(isDottedStem("C")).toBe(false);
  });
});
