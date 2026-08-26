import { THRESHOLD_IQ, tailP } from "@/lib/tails";

/** Instantiated tail formula; percent is computed, never a copied 2.28%. */
export function formatFormulaParam(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** Two decimals above the 0.1% floor so μ=100, σ=15 formats as 2.28%, not 2.275%. */
export function formatFormulaPercent(pHat: number): string {
  const q = 100 * pHat;
  if (q < 0.1) return `${q.toPrecision(2)}%`;
  return `${(Math.round(q * 100) / 100).toFixed(2)}%`;
}

export function formulaDisplay(mu: number, sigma: number): string {
  const pct = formatFormulaPercent(tailP(mu, sigma));
  return `1 − Φ((${THRESHOLD_IQ} − ${formatFormulaParam(mu)}) / ${formatFormulaParam(sigma)}) = ${pct}`;
}

export function FormulaBlock({ mu, sigma }: { mu: number; sigma: number }) {
  return (
    <p data-testid="formula-block" className="font-mono text-sm break-words">
      {formulaDisplay(mu, sigma)}
    </p>
  );
}
