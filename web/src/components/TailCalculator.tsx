"use client";

import { useMemo, useState } from "react";
import { REFERENCE_P_LABEL } from "@/lib/format";
import {
  FORMULA,
  FORMULA_DISPLAY,
  formatSandboxShare,
} from "@/lib/methodology";
import { DEFAULT_SIGMA, THRESHOLD_IQ, tailP } from "@/lib/tails";

const MU_MIN = 70;
const MU_MAX = 120;
const SIGMA_MIN = 6;
const SIGMA_MAX = 29;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function TailCalculator() {
  const [mu, setMu] = useState(100);
  const [sigma, setSigma] = useState(DEFAULT_SIGMA);

  const { z, share, outside1220 } = useMemo(() => {
    const zValue = (THRESHOLD_IQ - mu) / sigma;
    const p = tailP(mu, sigma);
    return {
      z: zValue,
      share: formatSandboxShare(p, mu, sigma),
      outside1220: sigma < 12 || sigma > 20,
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
        Modeled estimate of the population share at IQ ≥ {THRESHOLD_IQ} under a
        normal with mean μ and SD σ. Uses TypeScript{" "}
        <code className="font-mono text-xs">tailP</code> (Cephes{" "}
        <code className="font-mono text-xs">erfc</code>), not a transcribed
        constant. Default μ = 100, σ = 15 → {REFERENCE_P_LABEL}.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="text-sm">
          <label htmlFor="mu-input" className="font-medium">
            Mean μ (IQ points)
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
          1 − Φ(({THRESHOLD_IQ} − {mu}) / {sigma}) = 1 − Φ({z.toFixed(3)}) ≈{" "}
          {share}
        </div>
        <div className="mt-2">
          Modeled estimate: <strong>{share}</strong>
        </div>
      </div>
      {outside1220 ? (
        <p className="mt-2 text-sm text-stone-700">
          σ is inside the ingest window (5, 30) but outside [12, 20], so the
          pipeline would set{" "}
          <code className="font-mono text-xs">
            sigma_flag = &quot;outside_12_20&quot;
          </code>
          .
        </p>
      ) : null}
    </section>
  );
}
