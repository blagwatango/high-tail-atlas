import { describe, expect, it } from "vitest";
import { parsePreviewCsv, splitCsvLine } from "./csvPreview";

describe("splitCsvLine", () => {
  it("splits commas and quoted fields", () => {
    expect(splitCsvLine('USA,"United States, the",100')).toEqual([
      "USA",
      "United States, the",
      "100",
    ]);
  });
});

describe("parsePreviewCsv", () => {
  it("computes tailP for a valid country row with assumed sigma", () => {
    const csv = [
      "iso3,name,mu",
      "USA,United States,100",
    ].join("\n");
    const result = parsePreviewCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.sigmaAssumed).toBe(true);
    expect(result.rows[0]?.pHat).toBeCloseTo(0.022750131948179195, 12);
  });

  it("rejects person-level columns", () => {
    const csv = "iso3,mu,race\nUSA,100,x\n";
    const result = parsePreviewCsv(csv);
    expect(result.rows).toEqual([]);
    expect(result.errors[0]).toMatch(/person-level/i);
  });

  it("records schema errors without imputing neighbors", () => {
    const csv = "iso3,mu\nZZ,40\n";
    const result = parsePreviewCsv(csv);
    expect(result.rows[0]?.pHat).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
