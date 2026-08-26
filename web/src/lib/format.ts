import type { Quality } from "./schema";

export { REFERENCE_P, REFERENCE_P_LABEL } from "./colors";

export type FormatSurface = "map" | "table" | "drawer";

/** Half-up on the first unused digit — not banker's rounding. */
function roundHalfUp1(q: number): number {
  return Math.round(q * 10) / 10;
}

function formatA(q: number, surface: FormatSurface): string {
  if (q < 0.1) {
    return surface === "drawer" ? `${q.toPrecision(2)}%` : "<0.1%";
  }
  return `${roundHalfUp1(q).toFixed(1)}%`;
}

function formatCU(q: number): string {
  if (q < 1) return "<1%";
  return `~${Math.round(q)}%`;
}

function withTilde(label: string): string {
  return label.startsWith("~") ? label : `~${label}`;
}

/**
 * Format `p_hat` (proportion in [0, 1]) for a UI surface.
 *
 * Quality A: q≥0.1 → one decimal; q<0.1 → map/table `"<0.1%"`, drawer two sig figs.
 * Quality B: same as A with a leading tilde.
 * Quality C and U: q≥1 → `"~N%"` (0 decimals); q<1 → `"<1%"`.
 * Drawer equals map/table when q ≥ 0.1.
 */
export function formatPHat(
  pHat: number | null,
  quality: Quality | null,
  surface: FormatSurface = "table",
): string {
  if (pHat == null || quality == null) {
    return surface === "drawer" ? "No estimate" : "—";
  }
  const q = 100 * pHat;
  switch (quality) {
    case "A":
      return formatA(q, surface);
    case "B":
      return withTilde(formatA(q, surface));
    case "C":
    case "U":
      return formatCU(q);
    case "D": {
      const muted = formatCU(q);
      if (surface === "map") return "Insufficient data.";
      if (surface === "drawer") return `Insufficient data. ${muted}`;
      return muted;
    }
    case "E":
      return surface === "drawer" ? "Failed validation (quality E)" : "";
  }
}
