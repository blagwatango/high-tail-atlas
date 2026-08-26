import { describe, expect, it } from "vitest";
import {
  CSV_COLUMNS,
  CSV_FILENAME,
  buildEstimatesCsv,
  csvHeaderComments,
} from "./csv";
import { formatPHat } from "./format";
import { CountryRecord } from "./schema";

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
      { quality, p_hat: pHat, status },
    ),
  );
}

describe("estimates CSV", () => {
  const usa = country({ iso3: "USA", name: "United States" });
  const kor = country({
    iso3: "KOR",
    name: "Korea, Republic of",
    continent: "Asia",
    region_m49: "Eastern Asia",
  });

  it("uses the product filename, not a ranking name", () => {
    expect(CSV_FILENAME).toBe("high-tail-atlas-estimates.csv");
  });

  it("writes modeled-estimate header comments and dataset_id", () => {
    const comments = csvHeaderComments("demo-quality-c");
    expect(comments).toBe(
      [
        "# Modeled estimates, not measurements. p = 1 - Phi((130-mu)/sigma). Dataset demo-quality-c.",
        "# p_hat_display is a formatted string from the quality policy; p_hat_proportion is in [0,1].",
      ].join("\n"),
    );
  });

  it("exports p_hat_display and p_hat_proportion and never p_hat_pct", () => {
    const csv = buildEstimatesCsv([usa, kor], "demo-quality-c");
    const lines = csv.trimEnd().split("\n");
    expect(lines[0]).toContain("Dataset demo-quality-c.");
    expect(lines[2]).toBe(CSV_COLUMNS.join(","));
    expect(CSV_COLUMNS).toContain("p_hat_display");
    expect(CSV_COLUMNS).toContain("p_hat_proportion");
    expect(CSV_COLUMNS).not.toContain("p_hat_pct");
    expect(csv).not.toMatch(/p_hat_pct/);

    const header = lines[2].split(",");
    const usaCells = splitCsvLine(lines[3]);
    const displayIdx = header.indexOf("p_hat_display");
    const propIdx = header.indexOf("p_hat_proportion");
    expect(usaCells[displayIdx]).toBe(formatPHat(usa.p_hat, usa.quality, "table"));
    expect(usaCells[propIdx]).toBe(String(usa.p_hat));
    expect(usaCells[propIdx]).not.toBe(String(100 * (usa.p_hat ?? 0)));

    expect(lines[4]).toContain('"Korea, Republic of"');
  });
});

/** Split a single CSV record; quoted commas stay inside the field. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}
