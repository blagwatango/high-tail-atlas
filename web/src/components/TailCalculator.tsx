"use client";

import { useMemo, useState } from "react";
import { REFERENCE_P_LABEL } from "@/lib/format";
import {
  FORMULA,
  FORMULA_DISPLAY,
  formatSandboxShare,
} from "@/lib/methodology";
import { PISA_DEFAULT_MU, PISA_DEFAULT_SIGMA, PISA_THRESHOLD } from "@/lib/copy";
import { tailP } from "@/lib/tails";

const MU_MIN = 300;
const MU_MAX = 620;
const SIGMA_MIN = 60;
const SIGMA_MAX = 140;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function TailCalculator() {
  const [mu, setMu] = useState(PISA_DEFAULT_MU);
  const [sigma, setSigma] = useState(PISA_DEFAULT_SIGMA);

  const { z, share, outsideFlag } = useMemo(() => {
    const zValue = (PISA_THRESHOLD - mu) / sigma;
    const p = tailP(mu, sigma, PISA_THRESHOLD);
    return {
      z: zValue,
      share: formatSandboxShare(p, mu, sigma),
      outsideFlag: sigma < 70 || sigma > 130,
    };
  }, [mu, sigma]);

  return (
    <section
      className="mt-4 rounded-lg border border-stone-200 bg-white p-4"
      aria-labelledby="calculator-heading"
    >
      <h3 id="calculator-heading" className="text-base font-semibold">
        Interactive tail calculator
      </h3>
      <p className="mt-2 text-sm text-stone-700">
        Modeled estimate of the share of 15-year-olds at PISA mathematics ≥{" "}
        {PISA_THRESHOLD} under a normal with mean μ and SD σ. Uses TypeScript{" "}
        <code className="font-mono text-xs">tailP</code> (Cephes{" "}
        <code className="font-mono text-xs">erfc</code>), not a transcribed
        constant. Default μ = 500, σ = 100 → {REFERENCE_P_LABEL}.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="text-sm">
          <label htmlFor="mu-input" className="font-medium">
            Mean μ (PISA points)
          </label>
          <input
            className="mt-1 w-full accent-stone-800"
            type="range"
            min={MU_MIN}
            max={MU_MAX}
            step={1}
            value={mu}
            aria-label="Mean μ slider"
            onChange={(e) => setMu(Number(e.target.value))}
          />
          <input
            className="mt-2 w-full rounded border border-stone-300 px-2 py-1 font-mono text-sm"
            id="mu-input"
            type="number"
            min={MU_MIN}
            max={MU_MAX}
            step={1}
            value={mu}
            onChange={(e) => setMu(clamp(Number(e.target.value), MU_MIN, MU_MAX))}
          />
        </div>
        <div className="text-sm">
          <label htmlFor="sigma-input" className="font-medium">
            SD σ
          </label>
          <input
            className="mt-1 w-full accent-stone-800"
            type="range"
            min={SIGMA_MIN}
            max={SIGMA_MAX}
            step={1}
            value={sigma}
            aria-label="SD σ slider"
            onChange={(e) => setSigma(Number(e.target.value))}
          />
          <input
            className="mt-2 w-full rounded border border-stone-300 px-2 py-1 font-mono text-sm"
            id="sigma-input"
            type="number"
            min={SIGMA_MIN}
            max={SIGMA_MAX}
            step={1}
            value={sigma}
            onChange={(e) =>
              setSigma(clamp(Number(e.target.value), SIGMA_MIN, SIGMA_MAX))
            }
          />
        </div>
      </div>

      <div
        className="mt-4 rounded border border-stone-200 bg-stone-50 p-3 font-mono text-sm"
        role="status"
        aria-live="polite"
      >
        <div>{FORMULA}</div>
        <div className="mt-1 text-stone-600">{FORMULA_DISPLAY}</div>
        <div className="mt-2">
          1 − Φ(({PISA_THRESHOLD} − {mu}) / {sigma}) = 1 − Φ({z.toFixed(3)}) ≈{" "}
          {share}
        </div>
        <div className="mt-2">
          Modeled estimate: <strong>{share}</strong>
        </div>
      </div>
      {outsideFlag ? (
        <p className="mt-2 text-sm text-stone-700">
          σ is inside the ingest window (40, 150) but outside [70, 130].
        </p>
      ) : null}
    </section>
  );
}
