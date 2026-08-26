import { describe, expect, it } from "vitest";
import { pPct } from "./pct";
import { DEFAULT_SIGMA, THRESHOLD_IQ, normSf, tailP } from "./tails";

// scipy.stats.norm.sf(z) goldens; far tail (z=4) is the product.
const SCIPY_SF: Record<2 | 3 | 4, number> = {
  2: 0.022750131948179195,
  3: 0.0013498980316300933,
  4: 3.167124183311998e-5,
};

const ABS_TOL = 1e-12;

function expectWithinScipy(actual: number, scipy: number): void {
  expect(Math.abs(actual - scipy)).toBeLessThan(ABS_TOL);
}

describe("normSf / tailP", () => {
  it.each([2, 3, 4] as const)(
    "matches scipy.stats.norm.sf at z=%s within 1e-12",
    (z) => {
      expectWithinScipy(normSf(z), SCIPY_SF[z]);
    },
  );

  it("locks μ=100, σ=15 to scipy.stats.norm.sf(2)", () => {
    const p = tailP(100, 15);
    expectWithinScipy(p, SCIPY_SF[2]);
    expectWithinScipy(p, normSf(2));
  });

  it("far tail z=4 is μ=70, σ=15", () => {
    expectWithinScipy(tailP(70, 15), SCIPY_SF[4]);
    expectWithinScipy(tailP(THRESHOLD_IQ - DEFAULT_SIGMA * 4, DEFAULT_SIGMA), SCIPY_SF[4]);
  });

  it("uses default threshold 130", () => {
    expect(tailP(100, 15)).toBe(tailP(100, 15, 130));
  });
});

describe("pPct", () => {
  it("maps a proportion onto percentage points", () => {
    expect(pPct(0.022750131948179195)).toBe(2.2750131948179195);
    expect(pPct(0.02275)).toBe(2.275);
  });

  it("does not leave p_hat on a percent axis", () => {
    const pHat = tailP(100, 15);
    expect(pPct(pHat)).toBeGreaterThan(1);
    expect(pPct(pHat)).toBeLessThan(3);
    expect(pHat).toBeLessThan(0.03);
  });
});
