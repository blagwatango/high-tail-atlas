import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { HOME_INTRO, THIN_TAIL_NOTE } from "@/lib/copy";

export default function Home() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-5xl px-4 py-6 sm:py-10"
    >
      <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
        High-Tail Atlas
      </h1>
      <p className="mt-4 max-w-3xl text-stone-800">{HOME_INTRO}</p>
      <p
        data-testid="thin-tail-note"
        className="mt-3 max-w-3xl text-stone-800"
      >
        {THIN_TAIL_NOTE}
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
