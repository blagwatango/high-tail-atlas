import { describe, expect, it } from "vitest";
import {
  COLOR_FILTERED,
  COLOR_NO_DATA,
  P_BINS,
  REFERENCE_P,
  REFERENCE_P_LABEL,
  binFill,
  choroplethFill,
} from "./colors";

describe("reference constants", () => {
  it("keeps the conventional 2.28% label and 0.02275 proportion", () => {
    expect(REFERENCE_P).toBe(0.02275);
    expect(REFERENCE_P_LABEL).toBe("2.28%");
  });
});

describe("P_BINS", () => {
  it("starts at BuPu-6 #bfd3e6 and never uses #edf8fb", () => {
    expect(P_BINS[0]?.fill).toBe("#bfd3e6");
    const fills = P_BINS.map((b) => b.fill);
    expect(fills).toEqual([
      "#bfd3e6",
      "#9ebcda",
      "#8c96c6",
      "#8856a7",
      "#810f7c",
    ]);
    expect(fills).not.toContain("#edf8fb");
  });
});

describe("binFill", () => {
  it("maps the documented percentage cuts", () => {
    expect(binFill(0)).toBe("#bfd3e6");
    expect(binFill(0.004999)).toBe("#bfd3e6");
    expect(binFill(0.005)).toBe("#9ebcda");
    expect(binFill(0.014)).toBe("#9ebcda");
    expect(binFill(0.015)).toBe("#8c96c6");
    expect(binFill(REFERENCE_P)).toBe("#8c96c6");
    expect(binFill(0.025)).toBe("#8856a7");
    expect(binFill(0.044)).toBe("#8856a7");
    expect(binFill(0.045)).toBe("#810f7c");
    expect(binFill(0.09)).toBe("#810f7c");
  });

  it("returns no-data gray for null", () => {
    expect(binFill(null)).toBe(COLOR_NO_DATA);
    expect(COLOR_NO_DATA).toBe("#d1d5db");
    expect(COLOR_FILTERED).toBe("#e5e7eb");
  });
});

describe("choroplethFill", () => {
  it("uses filtered gray without treating it as no-data", () => {
    expect(
      choroplethFill({ pHat: 0.02, status: "ok", filteredOut: true }),
    ).toBe(COLOR_FILTERED);
    expect(
      choroplethFill({ pHat: null, status: "no_estimate", filteredOut: false }),
    ).toBe(COLOR_NO_DATA);
    expect(
      choroplethFill({ pHat: 0.02, status: "ok", filteredOut: false }),
    ).toBe("#8c96c6");
  });

  it("keeps no-estimate as no-data even when filteredOut is true", () => {
    expect(
      choroplethFill({
        pHat: null,
        status: "no_estimate",
        filteredOut: true,
      }),
    ).toBe(COLOR_NO_DATA);
    expect(
      choroplethFill({ pHat: null, status: "no_iso", filteredOut: true }),
    ).toBe(COLOR_NO_DATA);
    expect(
      choroplethFill({
        pHat: null,
        status: "excluded_territory",
        filteredOut: true,
      }),
    ).toBe(COLOR_NO_DATA);
  });
});
