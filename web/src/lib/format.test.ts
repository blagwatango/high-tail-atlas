import { describe, expect, it } from "vitest";
import {
  REFERENCE_P,
  REFERENCE_P_LABEL,
  formatPHat,
  type FormatSurface,
} from "./format";

/**
 * Worked-example table (σ=15, T=130, quality A). Inputs are the listed
 * proportions; display columns are the required golden strings.
 */
const WORKED_EXAMPLES = [
  { mu: 70, pHat: 3.167e-5, map: "<0.1%", drawer: "0.0032%" },
  { mu: 85, pHat: 1.35e-3, map: "0.1%", drawer: "0.1%" },
  { mu: 90, pHat: 3.83e-3, map: "0.4%", drawer: "0.4%" },
  { mu: 95, pHat: 9.815e-3, map: "1.0%", drawer: "1.0%" },
  { mu: 100, pHat: 2.275e-2, map: "2.3%", drawer: "2.3%" },
  { mu: 105, pHat: 4.779e-2, map: "4.8%", drawer: "4.8%" },
  { mu: 108, pHat: 7.12e-2, map: "7.1%", drawer: "7.1%" },
  { mu: 110, pHat: 9.12e-2, map: "9.1%", drawer: "9.1%" },
] as const;

describe("formatPHat quality A worked examples", () => {
  it.each(WORKED_EXAMPLES)(
    "μ=$mu map/table $map drawer $drawer",
    ({ pHat, map, drawer }) => {
      expect(formatPHat(pHat, "A", "map")).toBe(map);
      expect(formatPHat(pHat, "A", "table")).toBe(map);
      expect(formatPHat(pHat, "A", "drawer")).toBe(drawer);
    },
  );

  it("drawer equals map/table when q ≥ 0.1", () => {
    for (const row of WORKED_EXAMPLES) {
      if (100 * row.pHat < 0.1) continue;
      const surfaces: FormatSurface[] = ["map", "table", "drawer"];
      const labels = surfaces.map((s) => formatPHat(row.pHat, "A", s));
      expect(new Set(labels).size).toBe(1);
    }
  });
});

describe("formatPHat quality variants", () => {
  it("B prefixes A with a tilde, including the floor", () => {
    expect(formatPHat(2.275e-2, "B", "table")).toBe("~2.3%");
    expect(formatPHat(3.167e-5, "B", "map")).toBe("~<0.1%");
    expect(formatPHat(3.167e-5, "B", "drawer")).toBe("~0.0032%");
  });

  it("C and U use 0-decimal ~N% above 1% and <1% below", () => {
    expect(formatPHat(2.275e-2, "C", "table")).toBe("~2%");
    expect(formatPHat(2.275e-2, "U", "map")).toBe("~2%");
    expect(formatPHat(9.815e-3, "C", "drawer")).toBe("<1%");
    expect(formatPHat(3.167e-5, "U", "table")).toBe("<1%");
  });

  it("C drawer equals map/table", () => {
    expect(formatPHat(4.779e-2, "C", "drawer")).toBe(
      formatPHat(4.779e-2, "C", "table"),
    );
  });
});

describe("formatPHat rounding and constants", () => {
  it("uses half-up, not banker's, for one decimal", () => {
    // 2.25% — banker's would be 2.2%; half-up is 2.3%.
    expect(formatPHat(0.0225, "A", "table")).toBe("2.3%");
    // 1.25% — banker's 1.2%; half-up 1.3%.
    expect(formatPHat(0.0125, "A", "table")).toBe("1.3%");
  });

  it("keeps REFERENCE_P_LABEL at 2.28% while the A cell is 2.3%", () => {
    expect(REFERENCE_P).toBe(0.02275);
    expect(REFERENCE_P_LABEL).toBe("2.28%");
    expect(formatPHat(REFERENCE_P, "A", "table")).toBe("2.3%");
  });
});

describe("formatPHat D/E/null", () => {
  it("D map is insufficient-data; table uses the C number", () => {
    expect(formatPHat(2.275e-2, "D", "map")).toBe("Insufficient data.");
    expect(formatPHat(2.275e-2, "D", "table")).toBe("~2%");
    expect(formatPHat(2.275e-2, "D", "drawer")).toBe("Insufficient data. ~2%");
    expect(formatPHat(3.167e-5, "D", "table")).toBe("<1%");
  });

  it("E has no map/table percent; drawer names failed validation", () => {
    expect(formatPHat(2.275e-2, "E", "map")).toBe("");
    expect(formatPHat(2.275e-2, "E", "table")).toBe("");
    expect(formatPHat(2.275e-2, "E", "drawer")).toBe(
      "Failed validation (quality E)",
    );
  });

  it("null p_hat or quality is no estimate", () => {
    expect(formatPHat(null, "A", "table")).toBe("—");
    expect(formatPHat(2.275e-2, null, "map")).toBe("—");
    expect(formatPHat(null, null, "drawer")).toBe("No estimate");
  });
});
