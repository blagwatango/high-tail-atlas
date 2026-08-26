"use client";

import { useState, type ChangeEvent, type DragEvent } from "react";
import {
  parsePreviewCsv,
  type PreviewResult,
} from "@/lib/csvPreview";
import { formatSandboxShare } from "@/lib/methodology";

const WATERMARK = "browser preview — not the published artifact";

export function CsvPreview() {
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [dragOver, setDragOver] = useState(false);

  function ingestText(text: string) {
    setResult(parsePreviewCsv(text));
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    void file.text().then(ingestText);
  }

  function onInputChange(e: ChangeEvent<HTMLInputElement>) {
    onFile(e.target.files?.[0]);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    onFile(e.dataTransfer.files[0]);
  }

  return (
    <section className="mt-4" aria-labelledby="csv-preview-heading">
      <h2 id="csv-preview-heading" className="text-lg font-semibold">
        Local CSV preview
      </h2>
      <p className="mt-2 text-stone-800">
        Drop a country-level estimates CSV to see TypeScript{" "}
        <code className="font-mono text-sm">tailP</code> applied in the
        browser. Publishing still requires the Python pipeline; this table is
        a {WATERMARK}.
      </p>
      <div
        className={`mt-3 rounded-lg border-2 border-dashed px-4 py-6 text-sm ${
          dragOver
            ? "border-amber-500 bg-amber-50"
            : "border-stone-300 bg-white"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <label className="block">
          <span className="font-medium">Choose a CSV file</span>
          <input
            className="mt-2 block w-full text-sm"
            type="file"
            accept=".csv,text/csv"
            onChange={onInputChange}
          />
        </label>
        <p className="mt-2 text-stone-600">or drag and drop it here</p>
      </div>

      {result ? (
        <div className="relative mt-4 overflow-hidden rounded border border-amber-400">
          <p className="bg-amber-100 px-3 py-2 text-center text-sm font-semibold tracking-wide text-amber-950">
            {WATERMARK}
          </p>
          {result.errors.length > 0 ? (
            <ul className="list-disc space-y-1 px-6 py-3 text-sm text-stone-800">
              {result.errors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          ) : null}
          {result.rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-stone-100">
                  <tr>
                    <th className="px-3 py-2 font-medium">ISO-3</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    <th className="px-3 py-2 font-medium">μ</th>
                    <th className="px-3 py-2 font-medium">σ</th>
                    <th className="px-3 py-2 font-medium">
                      Estimated share ≥ 130
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={`${row.iso3 ?? row.name ?? "row"}-${i}`} className="border-t border-stone-200">
                      <td className="px-3 py-2 font-mono">{row.iso3 ?? "—"}</td>
                      <td className="px-3 py-2">{row.name ?? "—"}</td>
                      <td className="px-3 py-2 font-mono">
                        {row.mu == null ? "—" : row.mu}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {row.sigma == null
                          ? "—"
                          : row.sigmaAssumed
                            ? `${row.sigma} (assumed)`
                            : row.sigma}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {row.error
                          ? row.error
                          : row.pHat == null || row.mu == null || row.sigma == null
                            ? "—"
                            : formatSandboxShare(row.pHat, row.mu, row.sigma)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
