import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-10"
    >
      <h1 className="text-2xl font-semibold tracking-tight">High-Tail Atlas</h1>
      <p className="mt-4 max-w-3xl text-stone-800">
        Modeled estimates of the share of 15-year-olds at PISA mathematics ≥
        700. Country means are OECD PISA 2022 mathematics scores; figures are
        model output, not IQ and not a census.
      </p>
      <Suspense
        fallback={
          <section
            id="country-table"
            tabIndex={-1}
            aria-labelledby="table-heading"
            className="mt-6"
          >
            <h2 id="table-heading" className="text-lg font-semibold">
              Country estimates
            </h2>
            <p className="mt-3 text-stone-700">Loading modeled estimates…</p>
          </section>
        }
      >
        <Dashboard />
      </Suspense>
    </main>
  );
}
