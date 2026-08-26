import { erfc } from "./erfc";

export const THRESHOLD_IQ = 130;
export const DEFAULT_SIGMA = 15;

/** Survival function of N(0,1): 1 - Φ(z) = 0.5 * erfc(z / √2). */
export function normSf(z: number): number {
  return 0.5 * erfc(z / Math.SQRT2);
}

export function tailP(
  mu: number,
  sigma: number,
  threshold = THRESHOLD_IQ,
): number {
  return normSf((threshold - mu) / sigma);
}
