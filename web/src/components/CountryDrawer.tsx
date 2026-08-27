"use client";

import { useEffect } from "react";
import {
  formatEstimatedN,
  formatPHat,
  formatSigma,
} from "@/lib/format";
import type { CountryRecord, SampleType } from "@/lib/schema";
import { PISA_THRESHOLD } from "@/lib/copy";
import { FormulaBlock, formatFormulaPercent } from "./FormulaBlock";

export const WHAT_THIS_IS_NOT = [
  "This is not a census of people at PISA mathematics ≥ 700.",
  "It is a modeled estimate, not a ranking of people, nations, or worth.",
  "It is not a map of who can use AI.",
] as const;

export type DrawerBand =
  | { kind: "se"; lo: number; hi: number }
  | { kind: "pm3"; lo: number; hi: number }
  | { kind: "none" };

/** SE wins when present; ±3 is never shown beside it unlabeled. */
export function drawerPrimaryBand(row: CountryRecord): DrawerBand {
  if (row.p_hat == null) return { kind: "none" };
  if (row.p_lo_se != null && row.p_hi_se != null) {
    return { kind: "se", lo: row.p_lo_se, hi: row.p_hi_se };
  }
  if (row.p_lo_pm3 != null && row.p_hi_pm3 != null) {
    return { kind: "pm3", lo: row.p_lo_pm3, hi: row.p_hi_pm3 };
  }
  return { kind: "none" };
}

export function drawerShowsPm3Disclosure(row: CountryRecord): boolean {
  return (
    row.p_lo_se != null &&
    row.p_hi_se != null &&
    row.p_lo_pm3 != null &&
    row.p_hi_pm3 != null
  );
}

export function formatBandRange(lo: number, hi: number): string {
  return `${formatFormulaPercent(lo)}–${formatFormulaPercent(hi)}`;
}

const SAMPLE_TYPE_LABEL: Record<SampleType, string> = {
  adult_representative: "adult representative",
  students: "students",
  children: "children",
  urban: "urban",
  clinical: "clinical",
  convenience: "convenience",
  imputed: "imputed",
  unknown: "unknown",
};

function dash(value: string | number | null | undefined): string {
  if (value == null || value === "") return "—";
  return String(value);
}

function formatMu(mu: number | null): string {
  if (mu == null) return "—";
  if (Number.isInteger(mu)) return String(mu);
  return (Math.round(mu * 10) / 10).toFixed(1);
}

function formatPopulation(
  population: number | null,
  popYear: number | null,
): string {
  if (population == null) return "—";
  const n = population.toLocaleString("en-US");
  return popYear == null ? n : `${n} (${popYear})`;
}

function pm3Copy(lo: number, hi: number): string {
  return `Sensitivity to ±20 PISA points in the assumed mean (${formatBandRange(lo, hi)}; ~0.2σ if σ=100) — not a statistical confidence interval.`;
}

function seCopy(lo: number, hi: number): string {
  return `Interval from reported SE of the mean: ${formatBandRange(lo, hi)}, still conditional on normality and σ.`;
}

type CountryDrawerProps = {
  country: CountryRecord | null;
  onClose: () => void;
};

export function CountryDrawer({ country, onClose }: CountryDrawerProps) {
  useEffect(() => {
    if (country == null) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    if (window.matchMedia("(max-width: 639px)").matches) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [country, onClose]);

  if (country == null) return null;

  const band = drawerPrimaryBand(country);
  const disclosePm3 = drawerShowsPm3Disclosure(country);
  const mu = country.mu;
  const sigma = country.sigma;

  return (
    <>
      <button
        type="button"
        aria-label="Close country detail"
        className="fixed inset-0 z-30 bg-stone-900/40 sm:hidden"
        onClick={onClose}
      />
      <aside
        data-testid="country-drawer"
        data-iso3={country.iso3}
        aria-label="Country detail"
        className="fixed inset-x-0 bottom-0 z-40 flex max-h-[85vh] w-full flex-col overflow-y-auto rounded-t-xl border-t border-stone-200 bg-white p-4 text-sm shadow-lg sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:max-w-md sm:rounded-none sm:border-t-0 sm:border-l pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
      <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded-full bg-stone-300 sm:hidden" />
      <div className="flex items-start justify-between gap-3">
        <h3 id="country-drawer-title" className="font-medium text-base">
          {country.name}{" "}
          <span className="font-mono text-xs text-stone-500">
            {country.iso3}
          </span>
        </h3>
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded border border-stone-300 bg-white px-3 text-sm hover:bg-stone-100"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      <p data-testid="drawer-share" className="mt-4">
        Estimated share modeled at PISA mathematics ≥ 700:{" "}
        {formatPHat(country.p_hat, country.quality, "drawer")}
      </p>

      {band.kind === "se" ? (
        <p data-testid="drawer-band" data-band-kind="se" className="mt-1 text-stone-700">
          {seCopy(band.lo, band.hi)}
        </p>
      ) : null}
      {band.kind === "pm3" ? (
        <p data-testid="drawer-band" data-band-kind="pm3" className="mt-1 text-stone-700">
          {pm3Copy(band.lo, band.hi)}
        </p>
      ) : null}
      {disclosePm3 && country.p_lo_pm3 != null && country.p_hi_pm3 != null ? (
        <details data-testid="model-sensitivity" className="mt-1 text-stone-700">
          <summary className="cursor-pointer">Model sensitivity</summary>
          <p className="mt-1">{pm3Copy(country.p_lo_pm3, country.p_hi_pm3)}</p>
        </details>
      ) : null}

      {mu != null && sigma != null ? (
        <section className="mt-4" aria-labelledby="drawer-formula-heading">
          <h4 id="drawer-formula-heading" className="font-medium">
            Formula
          </h4>
          <div className="mt-1">
            <FormulaBlock mu={mu} sigma={sigma} threshold={PISA_THRESHOLD} />
          </div>
        </section>
      ) : null}

      <section className="mt-4" aria-labelledby="drawer-context-heading">
        <h4 id="drawer-context-heading" className="font-medium">
          Context
        </h4>
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-stone-600">μ</dt>
          <dd>{formatMu(country.mu)}</dd>
          <dt className="text-stone-600">σ</dt>
          <dd>{formatSigma(country.sigma, country.sigma_source)}</dd>
          <dt className="text-stone-600">σ flag</dt>
          <dd>
            {country.sigma_flag === "outside_12_20"
              ? "outside [12, 20]"
              : "—"}
          </dd>
          <dt className="text-stone-600">Population</dt>
          <dd>{formatPopulation(country.population, country.pop_year)}</dd>
          <dt className="text-stone-600">Est. people (total pop × share)</dt>
          <dd>{formatEstimatedN(country.estimated_n_ge_130)}</dd>
        </dl>
      </section>

      <section className="mt-4" aria-labelledby="drawer-provenance-heading">
        <h4 id="drawer-provenance-heading" className="font-medium">
          Provenance
        </h4>
        <dl
          data-testid="drawer-provenance"
          className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1"
        >
          <dt className="text-stone-600">Source</dt>
          <dd>{dash(country.source ?? country.source_short)}</dd>
          <dt className="text-stone-600">Year</dt>
          <dd>{dash(country.source_year)}</dd>
          <dt className="text-stone-600">Sample n</dt>
          <dd>
            {country.sample_n == null
              ? "—"
              : country.sample_n.toLocaleString("en-US")}
          </dd>
          <dt className="text-stone-600">Sample type</dt>
          <dd>
            {country.sample_type == null
              ? "—"
              : SAMPLE_TYPE_LABEL[country.sample_type]}
          </dd>
          <dt className="text-stone-600">Quality</dt>
          <dd>{dash(country.quality)}</dd>
          <dt className="text-stone-600">Link</dt>
          <dd>
            {country.source_url ? (
              <a
                href={country.source_url}
                className="break-all underline underline-offset-2"
                rel="noopener noreferrer"
                target="_blank"
              >
                {country.source_url}
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-stone-600">Notes</dt>
          <dd>{dash(country.notes)}</dd>
        </dl>
      </section>

      <section className="mt-4" aria-labelledby="drawer-not-heading">
        <h4 id="drawer-not-heading" className="font-medium">
          What this is not
        </h4>
        <p data-testid="drawer-what-this-is-not" className="mt-1 text-stone-700">
          {WHAT_THIS_IS_NOT.join(" ")}
        </p>
      </section>
    </aside>
    </>
  );
}
