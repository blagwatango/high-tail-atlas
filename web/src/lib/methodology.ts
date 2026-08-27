import { REFERENCE_P_LABEL } from "./format";
import { pPct } from "./pct";

/** Matches `atlas.json` `manifest.formula` and the Python PISA emitter. */
export const FORMULA = "p = 1 - Phi((700 - mu) / sigma)";

/** Display form of the same identity (not a different rounding of 2.28%). */
export const FORMULA_DISPLAY = "p = 1 − Φ((700 − μ) / σ)";

/**
 * Must match `pipeline/src/hightail/scale.py` PISA_SCALE.assumptions and
 * `atlas.json` `manifest.assumptions`.
 */
export const ASSUMPTIONS: readonly string[] = [
  "PISA mathematics scores among sampled 15-year-olds in school are modeled as i.i.d. N(mu_i, sigma_i^2). Real score distributions are discrete and bounded; the far tail is the least credible part of a normal.",
  "The OECD PISA scale was set so the initial OECD mean is 500 and SD is 100. 700 is +2 SD on that scale. It is scholastic achievement, not IQ.",
  "mu_i is the published 2022 country mean for 15-year-olds in school, not the adult resident population.",
  "sigma_i = 100 unless a country SD is published. Between-country SD differences are ignored.",
  "Applying p_hat to UN total population (including infants) is only order-of-magnitude context, not a count of 15-year-olds or of people who sat PISA.",
  "Countries that did not publish a 2022 PISA mathematics mean stay blank. Missing means are never filled from neighbors.",
];

export const SENSITIVITY_COPY =
  "Sensitivity to ±20 PISA points in the assumed mean (~0.2σ if σ=100) — not a statistical confidence interval.";

export const CITATIONS: readonly {
  id: string;
  text: string;
  href?: string;
}[] = [
  {
    id: "oecd-pisa-2022",
    text: "OECD (2023). PISA 2022 Results (Volume I): The State of Learning and Equity in Education. Table I.B1.2.1.",
    href: "https://doi.org/10.1787/53f23881-en",
  },
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
  if (
    (Math.abs(mu - 100) < 1e-9 && Math.abs(sigma - 15) < 1e-9) ||
    (Math.abs(mu - 500) < 1e-9 && Math.abs(sigma - 100) < 1e-9)
  ) {
    return REFERENCE_P_LABEL;
  }
  const q = pPct(pHat);
  if (q < 0.1) {
    return `${Number(q.toPrecision(2))}%`;
  }
  return `${q.toFixed(2)}%`;
}
