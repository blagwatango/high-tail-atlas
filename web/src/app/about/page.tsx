import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — High-Tail Atlas",
};

export default function AboutPage() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-6 sm:py-10"
    >
      <h1 className="text-2xl font-semibold tracking-tight">About</h1>
      <p className="mt-4 text-stone-800">
        High-Tail Atlas publishes <strong>modeled estimates</strong> of the
        share of 15-year-olds at PISA mathematics ≥ 700. That number is the
        right tail of a normal distribution given a published OECD PISA 2022
        mathematics country mean and SD (default 100). It is school achievement
        among sampled 15-year-olds, not IQ.
      </p>
      <p className="mt-4 text-stone-800">
        Country means are the published PISA 2022 mathematics scores. Countries
        that did not sit the test stay blank. Treat every cell as a model
        output with uncertainty, not a fact about national worth.
      </p>
      <p className="mt-4 text-stone-800">
        PISA 700 is +2 SD on the OECD origin scale. That tail is a thin slice
        of a normal — about 2.28% at mean 500 — not a census of who can use
        AI. If a claim required only people above +2 SD, the modeled share is
        that sliver, and most countries have no estimate.
      </p>
      <h2 className="mt-8 text-lg font-semibold">What we will not build</h2>
      <ul className="mt-3 list-disc space-y-2 pl-6 text-stone-800">
        <li>
          No racial, ethnic, religious, or immigrant-origin choropleths or
          breakdowns, inside countries or across them.
        </li>
        <li>
          No neighbor imputation of missing country means. If a country has no
          estimate, it stays missing; we will not fill it from adjacent
          countries.
        </li>
        <li>
          No intelligence contest framing: no trophy chrome, no scoreboard of
          nations. The product is estimates of a modeled tail share, not a
          ranking of people or worth.
        </li>
        <li>
          No vendored Lynn, Vanhanen, or Becker national-IQ tables in this
          repository. The default dataset is OECD PISA 2022 mathematics.
        </li>
      </ul>
    </main>
  );
}
