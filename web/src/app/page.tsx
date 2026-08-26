import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";

export default function Home() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">High-Tail Atlas</h1>
      <p className="mt-4 max-w-3xl text-stone-800">
        Modeled estimates of the population share at IQ ≥ 130. Country means are
        estimates; figures are model output, not a census of high-IQ people.
      </p>
      <Suspense
        fallback={
          <p className="mt-6 text-stone-700">Loading modeled estimates…</p>
        }
      >
        <Dashboard />
      </Suspense>
    </main>
  );
}
