import type { Metadata } from "next";
import Link from "next/link";
import { CsvPreview } from "@/components/CsvPreview";
import { ManifestView } from "@/components/ManifestView";
import { publicDataPath } from "@/lib/atlas";
import { ESTIMATES_CSV_COLUMNS } from "@/lib/csvPreview";
import { FORMULA } from "@/lib/methodology";

export const metadata: Metadata = {
  title: "Data — High-Tail Atlas",
  description:
    "Published atlas.json manifest, download pointer, and estimates CSV schema. Modeled estimates, not measurements.",
};

export default function DataPage() {
  const atlasPath = publicDataPath("atlas.json");

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto max-w-3xl px-4 py-10"
    >
      <h1 className="text-2xl font-semibold tracking-tight">Data</h1>
      <p className="mt-4 text-stone-800">
        The published artifact is a single static file,{" "}
        <code className="font-mono text-sm">atlas.json</code>, fetched at
        runtime. It embeds the full manifest (dataset id, formula, assumption
        list, quality counts). Figures are <strong>modeled estimates</strong>,
        not measurements. Formula:{" "}
        <span className="font-mono text-sm">{FORMULA}</span>.
      </p>

      <section className="mt-10" aria-labelledby="download-heading">
        <h2 id="download-heading" className="text-lg font-semibold">
          Download pointer
        </h2>
        <p className="mt-3 text-stone-800">
          Current published file:{" "}
          <a className="font-medium underline underline-offset-2" href={atlasPath}>
            {atlasPath}
          </a>
          . Table CSV export (when the explorer ships) is named{" "}
          <code className="font-mono text-sm">high-tail-atlas-estimates.csv</code>{" "}
          and carries the same modeled-estimate disclaimer. Do not treat a
          browser preview as that artifact.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="manifest-heading">
        <h2 id="manifest-heading" className="text-lg font-semibold">
          Manifest
        </h2>
        <p className="mt-3 text-stone-800">
          Pretty-printed <code className="font-mono text-sm">manifest</code>{" "}
          from the fetched artifact. Assumptions and the formula also appear on{" "}
          <Link href="/methodology/" className="underline">
            Methodology
          </Link>
          .
        </p>
        <ManifestView />
      </section>

      <section className="mt-10" aria-labelledby="schema-heading">
        <h2 id="schema-heading" className="text-lg font-semibold">
          Input CSV schema
        </h2>
        <p className="mt-3 text-stone-800">
          Bring-your-own estimates files must match{" "}
          <code className="font-mono text-sm">estimates.schema.json</code>. UTF-8
          with a header row. Empty cells are omitted. One row per ISO-3.
          Neighbor imputation is refused.
        </p>
        <div className="mt-3 overflow-x-auto rounded border border-stone-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-100">
              <tr>
                <th className="px-3 py-2 font-medium">Column</th>
                <th className="px-3 py-2 font-medium">Required</th>
                <th className="px-3 py-2 font-medium">Notes</th>
              </tr>
            </thead>
            <tbody>
              {ESTIMATES_CSV_COLUMNS.map((col) => (
                <tr key={col.name} className="border-t border-stone-200">
                  <td className="px-3 py-2 font-mono">{col.name}</td>
                  <td className="px-3 py-2">{col.required ? "yes" : "no"}</td>
                  <td className="px-3 py-2 text-stone-800">{col.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-stone-700">
          Either <code className="font-mono">iso3</code> or{" "}
          <code className="font-mono">name</code> is required together with{" "}
          <code className="font-mono">mu</code>.
        </p>
      </section>

      <CsvPreview />
    </main>
  );
}
