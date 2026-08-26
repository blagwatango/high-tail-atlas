/** Proportion [0,1] → percentage points. The only mapping allowed onto a % axis. */
export function pPct(pHat: number): number {
  return 100 * pHat;
}
