import { REFERENCE_P_LABEL } from "./format";
import { pPct } from "./pct";

/** Matches `atlas.json` `manifest.formula` and the Python emitter. */
export const FORMULA = "p = 1 - Phi((130 - mu) / sigma)";

/** Display form of the same identity (not a different rounding of 2.28%). */
export const FORMULA_DISPLAY = "p = 1 − Φ((130 − μ) / σ)";

/**
 * Must match `pipeline/src/hightail/emit.py` ASSUMPTIONS and
 * `atlas.json` `manifest.assumptions`.
 */
export const ASSUMPTIONS: readonly string[] = [
  "IQ in each country is i.i.d. N(mu_i, sigma_i^2). Real distributions are discrete, bounded, and often skewed; the far tail is the part of a normal that is least credible.",
  "Tests, if any, are interval-scaled on the same metric as IQ points.",
  "mu_i is an unbiased estimate of the current national resident mean. Most sources fail this (children, convenience, old tests, Flynn drift, urban samples).",
  "sigma_i = 15 unless published. Between-country variance of SDs is ignored. If true sigma_i > 15, p_hat is understated for mu_i < 130; if sigma_i < 15, overstated.",
  "Independence from age structure. Applying p_hat to total population (including infants) is a modeling convenience, not a claim that toddlers have IQ scores. v1 does not age-standardize.",
  "No correction for restriction of range, test ceiling, or Flynn effect inside this pipeline. If the source already adjusted, that belongs in provenance, not a second adjustment.",
];

export const SENSITIVITY_COPY =
  "Sensitivity to ±3 IQ points in the assumed mean (~0.2σ if σ=15) — not a statistical confidence interval.";

export const CITATIONS: readonly {
  id: string;
  text: string;
  href?: string;
}[] = [
  {
    id: "ehbea",
    text: "EHBEA (2020). Statement on National IQ Datasets.",
    href: "https://www.ehbea.org/pages/national-iq-datasets",
  },
  {
    id: "sear",
    text: "Sear, R. (2022). ‘National IQ’ datasets do not provide accurate, unbiased or comparable measures of cognitive ability worldwide.",
    href: "https://www.researchgate.net/publication/360665701",
  },
  {
    id: "wicherts",
    text: "Wicherts, J. M., Dolan, C. V., & van der Maas, H. L. J. (2010). A systematic literature review of the average IQ of sub-Saharan Africans. Intelligence.",
  },
  {
    id: "wpp",
    text: "United Nations, DESA/Population Division (2024). World Population Prospects 2024.",
    href: "https://population.un.org/wpp/",
  },
  {
    id: "scipy",
    text: "scipy.stats.norm.sf — Python publisher of p_hat stored in atlas.json.",
  },
  {
    id: "cephes",
    text: "Cephes complementary error function (Moshier), vendored for the TypeScript calculator (0.5 · erfc(z / √2)). Golden-tested against scipy at z = 2, 3, 4.",
  },
  {
    id: "retraction",
    text: "Retraction Watch (2025). Coverage of retractions tied to national-IQ database use.",
    href: "https://retractionwatch.com/2025/11/25/meet-the-researcher-aiming-to-halt-use-of-fundamentally-flawed-database-linking-iq-and-nationality/",
  },
];

/**
 * Sandbox percent label. μ=100, σ=15 is always REFERENCE_P_LABEL (2.28%),
 * never 2.275%.
 */
export function formatSandboxShare(
  pHat: number,
  mu: number,
  sigma: number,
): string {
  if (Math.abs(mu - 100) < 1e-9 && Math.abs(sigma - 15) < 1e-9) {
    return REFERENCE_P_LABEL;
  }
  const q = pPct(pHat);
  if (q < 0.1) {
    return `${Number(q.toPrecision(2))}%`;
  }
  return `${q.toFixed(2)}%`;
}
