import { describe, expect, it } from "vitest";
import { REFERENCE_P_LABEL } from "@/lib/format";
import { tailP } from "@/lib/tails";
import {
  formatFormulaPercent,
  formulaDisplay,
} from "./FormulaBlock";

describe("formulaDisplay", () => {
  it("μ=100, σ=15 → 2.28% from tailP, not a transcribed constant", () => {
    expect(formulaDisplay(100, 15)).toBe(
      "1 − Φ((130 − 100) / 15) = 2.28%",
    );
    expect(formatFormulaPercent(tailP(100, 15))).toBe(REFERENCE_P_LABEL);
    expect(formulaDisplay(100, 15)).toContain(
      formatFormulaPercent(tailP(100, 15)),
    );
  });

  it("μ=98 is not 2.28%", () => {
    const text = formulaDisplay(98, 15);
    expect(text).toBe(
      `1 − Φ((130 − 98) / 15) = ${formatFormulaPercent(tailP(98, 15))}`,
    );
    expect(text).not.toContain("= 2.28%");
  });

  it("never writes 2.275%", () => {
    expect(formulaDisplay(100, 15)).not.toContain("2.275%");
    expect(formatFormulaPercent(tailP(100, 15))).not.toBe("2.275%");
    expect(formatFormulaPercent(tailP(110, 15))).not.toContain("2.275");
  });

  it("uses this country's μ and σ in the Φ argument", () => {
    expect(formulaDisplay(110, 15)).toContain("(130 − 110) / 15");
    expect(formulaDisplay(90, 12.4)).toContain("(130 − 90) / 12.4");
  });
});
