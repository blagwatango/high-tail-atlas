import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — High-Tail Atlas",
};

export default function AboutPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">About</h1>
      <p className="mt-4 text-stone-800">
        High-Tail Atlas will publish <strong>modeled estimates</strong> of the
        share of each country’s population at IQ ≥ 130. That number is the right
        tail of a normal distribution given a published or assumed country mean
        and SD (default 15), applied to UN population counts. It is not a
        measurement of anyone’s IQ.
      </p>
      <p className="mt-4 text-stone-800">
        Country means are <strong>estimates</strong>. Published compilations are
        incomplete and contested: convenience samples, mixed tests, and missing
        countries are common. Treat every cell as a model output with
        uncertainty, not a fact about national worth.
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
          repository. v1 ships a labeled DEMO dataset (later); a user-supplied
          CSV path may follow without rewriting the charts.
        </li>
      </ul>
    </main>
  );
}
