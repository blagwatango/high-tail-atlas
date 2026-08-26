import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Methodology — High-Tail Atlas",
};

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Methodology</h1>
      <p className="mt-4 text-stone-800">
        These figures are <strong>modeled estimates</strong>, not measurements.
        Each percentage is the right tail of a normal distribution given a
        published or assumed country mean and SD (default 15), applied to UN
        population counts. National IQ compilations are incomplete and
        contested. This is <strong>not</strong> a ranking of people, nations, or
        worth.
      </p>
      <p className="mt-4 text-stone-800">
        The documented formula (later work) is{" "}
        <span className="font-mono text-sm">
          p = 1 − Φ((130 − μ) / σ)
        </span>{" "}
        with default σ = 15. Full provenance, quality flags, and a calculator
        are not in this scaffold.
      </p>
    </main>
  );
}
