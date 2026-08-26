import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { AtlasFile, CountryRecord, EstimateRow } from "./schema";

const fixturePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../data/fixtures/expected_atlas_min.json",
);

function loadMinAtlas(): unknown {
  return JSON.parse(readFileSync(fixturePath, "utf8"));
}

describe("AtlasFile", () => {
  it("parses expected_atlas_min.json", () => {
    const parsed = AtlasFile.parse(loadMinAtlas());
    expect(parsed.manifest.schema_version).toBe(1);
    expect(parsed.manifest.threshold_iq).toBe(130);
    expect(parsed.manifest.default_sigma).toBe(15);
    expect(parsed.manifest.flags.demo_badge).toBe(true);
    expect(parsed.unmatched_estimates).toEqual([]);
    expect(parsed.countries).toHaveLength(2);

    const ok = parsed.countries.find((c) => c.status === "ok");
    expect(ok?.iso3).toBe("USA");
    expect(ok?.quality).toBe("C");
    expect(ok?.p_hat).not.toBeNull();
    expect(ok?.p_lo_pm3).not.toBeNull();
    expect(ok?.p_hi_pm3).not.toBeNull();
    expect(ok?.mu_se).toBeNull();
    expect(ok?.p_lo_se).toBeNull();
    expect(ok?.p_hi_se).toBeNull();

    const missing = parsed.countries.find((c) => c.status === "no_estimate");
    expect(missing?.quality).toBeNull();
    expect(missing?.mu).toBeNull();
    expect(missing?.p_hat).toBeNull();
  });

  it("rejects a CountryRecord that is ok but quality is null", () => {
    const parsed = AtlasFile.parse(loadMinAtlas());
    const ok = parsed.countries.find((c) => c.status === "ok");
    expect(ok).toBeDefined();
    expect(() => CountryRecord.parse({ ...ok, quality: null })).toThrow();
  });

  it("rejects a CountryRecord that is ok but p_hat is null", () => {
    const parsed = AtlasFile.parse(loadMinAtlas());
    const ok = parsed.countries.find((c) => c.status === "ok");
    expect(ok).toBeDefined();
    expect(() => CountryRecord.parse({ ...ok, p_hat: null })).toThrow();
  });

  it("rejects p_lo_se when mu_se is null", () => {
    const parsed = AtlasFile.parse(loadMinAtlas());
    const ok = parsed.countries.find((c) => c.status === "ok");
    expect(ok).toBeDefined();
    expect(() =>
      CountryRecord.parse({ ...ok, mu_se: null, p_lo_se: 0.01, p_hi_se: 0.03 }),
    ).toThrow();
  });
});

describe("EstimateRow", () => {
  it("accepts empty source_url via emptyToUndef", () => {
    const row = EstimateRow.parse({
      iso3: "USA",
      mu: 100,
      source_url: "",
    });
    expect(row.source_url).toBeUndefined();
  });

  it("accepts a valid source_url", () => {
    const row = EstimateRow.parse({
      name: "United States",
      mu: 100,
      source_url: "https://example.com/estimates",
    });
    expect(row.source_url).toBe("https://example.com/estimates");
  });

  it("rejects a row with neither iso3 nor name", () => {
    expect(() => EstimateRow.parse({ mu: 100 })).toThrow(/iso3 or name/);
  });
});
