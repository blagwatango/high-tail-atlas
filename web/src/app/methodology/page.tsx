import type { Metadata } from "next";
import Link from "next/link";
import { ManifestView } from "@/components/ManifestView";
import { TailCalculator } from "@/components/TailCalculator";
import { REFERENCE_P_LABEL } from "@/lib/format";
import {
  ASSUMPTIONS,
  CITATIONS,
  FORMULA,
  FORMULA_DISPLAY,
  SENSITIVITY_COPY,
} from "@/lib/methodology";

export const metadata: Metadata = {
  title: "Methodology — High-Tail Atlas",
  description:
    "Modeled estimates of the share of 15-year-olds at PISA mathematics ≥ 700: formula, assumptions, and a tail calculator.",
};

export default function MethodologyPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-6 sm:py-10"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Methodology</h1>
      <p className="mt-4 text-stone-800">
        These figures are <strong>modeled estimates</strong>, not measurements.
        Each percentage is the right tail of a normal distribution given a
        published PISA 2022 mathematics country mean and SD (default 100), for
        15-year-olds in school. This is scholastic achievement, not IQ. This is{" "}
        <strong>not</strong> a ranking of people, nations, or worth.
      </p>

      <section className="mt-10" aria-labelledby="formula-heading">
        <h2 id="formula-heading" className="text-lg font-semibold">
          1. Formula
        </h2>
        <p className="mt-3 text-stone-800">
          Let T = 700 (PISA scale +2 SD; not a dashboard control). For a
          country with published PISA mathematics mean μ and SD σ,
        </p>
        <p className="mt-3 font-mono text-sm text-stone-900">{FORMULA}</p>
        <p className="mt-1 font-mono text-sm text-stone-700">
          {FORMULA_DISPLAY}
        </p>
        <p className="mt-3 text-stone-800">
          equivalently{" "}
          <span className="font-mono text-sm">
            p̂ = scipy.stats.norm.sf((700 − μ) / σ)
          </span>
          . Under μ = 500 and σ = 100 this is 1 − Φ(2), labeled{" "}
          {REFERENCE_P_LABEL} in legends and on this page (quality-A cells round
          that value to 2.3%). A +2 SD cutoff is a thin tail of a normal, not a
          map of who can use AI. Python publishes <code className="font-mono text-sm">p_hat</code> in{" "}
          <code className="font-mono text-sm">atlas.json</code>; the calculator
          below recomputes the same survival function in TypeScript.
        </p>
        <TailCalculator />
      </section>

      <section className="mt-10" aria-labelledby="assumptions-heading">
        <h2 id="assumptions-heading" className="text-lg font-semibold">
          2. Assumptions
        </h2>
        <p className="mt-3 text-stone-800">
          The following list is stored on{" "}
          <code className="font-mono text-sm">manifest.assumptions</code> and is
          required reading for every modeled estimate:
        </p>
        <ol className="mt-3 list-decimal space-y-2 pl-6 text-stone-800">
          {ASSUMPTIONS.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="sigma-heading">
        <h2 id="sigma-heading" className="text-lg font-semibold">
          3. Why σ = 100 is assumed
        </h2>
        <p className="mt-3 text-stone-800">
          The OECD PISA scale was defined so that a reference population has
          mean 500 and SD 100. Country reports usually publish a mean, not a
          country-specific σ. When the source omits σ, the pipeline sets σ =
          100.
        </p>
        <p className="mt-3 text-stone-800">
          If a source does publish σ, it is passed through when σ ∈ (40, 150).
          Between-country variance of SDs is otherwise ignored.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="normality-heading">
        <h2 id="normality-heading" className="text-lg font-semibold">
          4. Why normality is worst in the tail
        </h2>
        <p className="mt-3 text-stone-800">
          Real score distributions are discrete, bounded, and often skewed.
          The far right tail is the part of a normal that is{" "}
          <strong>least</strong> credible, and that is exactly the region this
          product uses. Heavier-tailed models (Student-t, mixtures) would raise
          p̂ for a given μ, but they introduce a second parameter
          (degrees of freedom or mixture weight) that is unidentifiable from
          published country means. Shipping them would look like a more
          sophisticated measurement while adding untestable knobs — a worse
          overclaim than a documented normal.
        </p>
        <p className="mt-3 text-stone-800">
          v1 does not use t-distributions or mixtures. The calculator stays on
          Φ. There is no “robust tail” toggle.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="age-heading">
        <h2 id="age-heading" className="text-lg font-semibold">
          5. Why age structure is ignored in v1
        </h2>
        <p className="mt-3 text-stone-800">
          The modeled share p̂ is multiplied by UN WPP mid-year{" "}
          <em>total</em> population, including infants. That is a modeling
          convenience, not a claim that infants sat PISA. PISA samples
          15-year-olds in school. Estimated headcounts are order-of-magnitude
          context only, not a census of high-scoring 15-year-olds.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="delta-heading">
        <h2 id="delta-heading" className="text-lg font-semibold">
          6. Why δ = 20 is sensitivity, not a confidence interval
        </h2>
        <p className="mt-3 text-stone-800">{SENSITIVITY_COPY}</p>
        <p className="mt-3 text-stone-800">
          When the source does not report SE(μ), the pipeline stores an
          illustrative band by shifting μ by δ = 20 PISA points (~0.2σ if σ =
          100) and recomputing the tail. That band is not a standard error, not
          one source SD, and not a statistical confidence interval. If the
          source does report <code className="font-mono text-sm">mu_se</code>, a
          separate interval from ±1.96 SE is stored and labeled as still
          conditional on normality and σ. The two bands are never drawn
          unlabeled beside each other, and neither is mapped as a choropleth
          fill.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="limitations-heading">
        <h2 id="limitations-heading" className="text-lg font-semibold">
          7. Dataset limitations
        </h2>
        <p className="mt-3 text-stone-800">
          Country means are estimates, often from sparse and methodologically
          contested compilations. Documented problems include convenience
          samples, children-only or clinical samples treated as national,
          mixed instruments and non-comparable norms, Flynn-effect drift, and
          cultural loading of tests. Neighbor-country imputation of missing
          means is <strong>refused</strong>: unmatched rows never receive a
          fake ISO-3, and countries without an estimate stay{" "}
          <code className="font-mono text-sm">status = &quot;no_estimate&quot;</code>{" "}
          with null μ and p̂. We do not vendor Lynn/Vanhanen/Becker
          national-IQ tables. The default dataset is OECD PISA 2022
          mathematics country means. Countries that did not sit PISA 2022 stay
          blank.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="ethics-heading">
        <h2 id="ethics-heading" className="text-lg font-semibold">
          8. Ethical note
        </h2>
        <p className="mt-3 text-stone-800">
          National-IQ tables have a documented history of misuse in “race
          science” and immigration-restriction propaganda (EHBEA statement;
          Sear 2022; subsequent retractions). This product will not provide a
          “dumbest countries” view, an “IQ rankings” board, or racial, ethnic,
          religious, or immigrant-origin choropleths or breakdowns — inside
          countries or across them. Visible copy uses <em>estimate</em> and{" "}
          <em>modeled</em>, not contest-of-nations framing.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="manifest-heading">
        <h2 id="manifest-heading" className="text-lg font-semibold">
          9. Published manifest
        </h2>
        <p className="mt-3 text-stone-800">
          Pretty-printed <code className="font-mono text-sm">manifest</code>{" "}
          from the fetched <code className="font-mono text-sm">atlas.json</code>{" "}
          (client island). Swapping the JSON and redeploying static files is
          how datasets are replaced; see{" "}
          <Link href="/data/" className="underline">
            Data
          </Link>
          .
        </p>
        <ManifestView />
      </section>

      <section className="mt-10" aria-labelledby="replace-heading">
        <h2 id="replace-heading" className="text-lg font-semibold">
          10. How to replace the estimates file
        </h2>
        <p className="mt-3 text-stone-800">
          Bring your own CSV matching{" "}
          <code className="font-mono text-sm">data/schemas/estimates.schema.json</code>
          . Required columns: <code className="font-mono text-sm">iso3</code>{" "}
          or <code className="font-mono text-sm">name</code>, and{" "}
          <code className="font-mono text-sm">mu</code>. Optional: sigma, source
          fields, sample metadata. Then run the Python pipeline and point{" "}
          <code className="font-mono text-sm">--out</code> at{" "}
          <code className="font-mono text-sm">web/public/data/atlas.json</code>
          :
        </p>
        <pre
          tabIndex={0}
          aria-label="Pipeline build command"
          className="mt-3 overflow-x-auto rounded border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800"
        >{`python -m hightail.cli build \\
  --estimates data/raw/estimates.csv \\
  --population data/raw/wpp_extract.csv \\
  --overrides data/overrides/iso3_overrides.yaml \\
  --policy data/overrides/territory_policy.yaml \\
  --out web/public/data/atlas.json \\
  --reference-year 2025`}</pre>
        <p className="mt-3 text-stone-800">
          The web app never reads the CSV directly. Charts consume the Zod{" "}
          <code className="font-mono text-sm">AtlasFile</code> contract; if that
          still parses, the JavaScript bundle need not change. A local CSV
          preview on the data page is watermarked and is not the published
          artifact.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="citations-heading">
        <h2 id="citations-heading" className="text-lg font-semibold">
          Citations
        </h2>
        <ul className="mt-3 list-disc space-y-2 pl-6 text-stone-800">
          {CITATIONS.map((c) => (
            <li key={c.id}>
              {c.href ? (
                <a
                  className="underline underline-offset-2"
                  href={c.href}
                  rel="noreferrer"
                >
                  {c.text}
                </a>
              ) : (
                c.text
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
