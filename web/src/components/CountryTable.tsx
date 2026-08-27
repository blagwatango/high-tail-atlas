"use client";

import { useMemo } from "react";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { buildEstimatesCsv, CSV_FILENAME } from "@/lib/csv";
import type { SortKey } from "@/lib/filters";
import {
  formatEstimatedN,
  formatPHat,
  formatSigma,
} from "@/lib/format";
import type { CountryRecord, Quality } from "@/lib/schema";

const columnHelper = createColumnHelper<CountryRecord>();

const QUALITY_HINT: Record<Quality, string> = {
  A: "Nationally representative adult sample",
  B: "Large sample, incomplete frame",
  C: "Convenience, children, clinical, or demo fixture",
  D: "Neighbor-imputed or undocumented re-publish",
  E: "Failed validation",
  U: "Unknown sample quality",
};

const QUALITY_CLASS: Record<Quality, string> = {
  A: "border-stone-700 bg-stone-100 text-stone-900",
  B: "border-stone-600 bg-stone-50 text-stone-900",
  C: "border-amber-700 bg-amber-50 text-stone-900",
  D: "border-stone-400 bg-stone-50 text-stone-500",
  E: "border-stone-400 bg-stone-50 text-stone-500",
  U: "border-amber-700 bg-amber-50 text-stone-900",
};

type CountryTableProps = {
  rows: CountryRecord[];
  sort: SortKey;
  datasetId: string;
  popYear: number | null;
  selectedIso3?: string | null;
  onSortChange: (sort: SortKey) => void;
  onSelectIso3?: (iso3: string) => void;
};

function SortHeader({
  label,
  sortKey,
  current,
  onChange,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  onChange: (sort: SortKey) => void;
}) {
  const active = current === sortKey;
  const marker = sortKey === "name" ? "↑" : "↓";
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 text-left font-medium hover:underline"
      aria-pressed={active}
      onClick={() => onChange(sortKey)}
    >
      {label}
      <span className={active ? "text-stone-700" : "text-stone-300"} aria-hidden>
        {marker}
      </span>
    </button>
  );
}

function QualityBadge({ quality }: { quality: Quality | null }) {
  if (quality == null) return <span>—</span>;
  return (
    <span
      title={QUALITY_HINT[quality]}
      aria-label={`Quality ${quality}: ${QUALITY_HINT[quality]}`}
      className={`inline-block rounded border px-1.5 py-0.5 font-mono text-xs ${QUALITY_CLASS[quality]}`}
    >
      {quality}
    </span>
  );
}

function ariaSort(
  columnId: string,
  sort: SortKey,
): "ascending" | "descending" | "none" | undefined {
  if (columnId !== "name" && columnId !== "p_hat" && columnId !== "population") {
    return undefined;
  }
  if (columnId !== sort) return "none";
  return columnId === "name" ? "ascending" : "descending";
}

function downloadCsv(text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = CSV_FILENAME;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function CountryTable({
  rows,
  sort,
  datasetId,
  popYear,
  selectedIso3,
  onSortChange,
  onSelectIso3,
}: CountryTableProps) {
  const populationLabel =
    popYear != null ? `Population (${popYear})` : "Population";

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: "row_in_sort",
        header: () => (
          <span title="Row number in current sort">#</span>
        ),
        cell: (info) => (
          <span className="tabular-nums text-stone-500">
            {info.row.index + 1}
          </span>
        ),
      }),
      columnHelper.accessor("name", {
        header: () => (
          <SortHeader
            label="Country"
            sortKey="name"
            current={sort}
            onChange={onSortChange}
          />
        ),
        cell: (info) => {
          const iso3 = info.row.original.iso3;
          const selected = selectedIso3 === iso3;
          return (
            <button
              type="button"
              className="text-left underline-offset-2 hover:underline"
              aria-pressed={selected}
              onClick={() => onSelectIso3?.(iso3)}
            >
              {info.getValue()}
            </button>
          );
        },
      }),
      columnHelper.accessor("iso3", {
        header: "ISO-3",
        cell: (info) => (
          <span className="font-mono text-xs">{info.getValue()}</span>
        ),
      }),
      columnHelper.accessor("p_hat", {
        header: () => (
          <SortHeader
            label="Estimated % ≥ 700"
            sortKey="p_hat"
            current={sort}
            onChange={onSortChange}
          />
        ),
        cell: (info) => {
          const q = info.row.original.quality;
          return (
            <span
              className={`tabular-nums ${q === "D" ? "text-stone-400" : ""}`}
            >
              {formatPHat(info.getValue(), q, "table")}
            </span>
          );
        },
      }),
      columnHelper.accessor("estimated_n_ge_130", {
        header: "Est. people (pop × share)",
        cell: (info) => (
          <span className="tabular-nums text-stone-700">
            {formatEstimatedN(info.getValue())}
          </span>
        ),
      }),
      columnHelper.accessor("population", {
        header: () => (
          <SortHeader
            label={populationLabel}
            sortKey="population"
            current={sort}
            onChange={onSortChange}
          />
        ),
        cell: (info) => {
          const n = info.getValue();
          return (
            <span className="tabular-nums">
              {n == null ? "—" : n.toLocaleString("en-US")}
            </span>
          );
        },
      }),
      columnHelper.accessor("quality", {
        header: "Quality",
        cell: (info) => <QualityBadge quality={info.getValue()} />,
      }),
      columnHelper.accessor("source_year", {
        header: "Source year",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.accessor("source_short", {
        header: "Source",
        cell: (info) => info.getValue() ?? "—",
      }),
      columnHelper.display({
        id: "sigma",
        header: () => <span title="Standard deviation">σ</span>,
        cell: (info) =>
          formatSigma(
            info.row.original.sigma,
            info.row.original.sigma_source,
          ),
      }),
    ],
    [onSelectIso3, onSortChange, populationLabel, selectedIso3, sort],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.iso3,
  });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-stone-600">
          Modeled estimates in the current filter and sort. Headcounts are
          context only.
        </p>
        <button
          type="button"
          data-testid="download-csv"
          className="inline-flex min-h-11 items-center rounded border border-stone-300 bg-white px-3 text-sm hover:bg-stone-100"
          onClick={() => downloadCsv(buildEstimatesCsv(rows, datasetId))}
        >
          Download CSV
        </button>
      </div>
      <div className="-mx-3 max-h-[36rem] overflow-auto sm:mx-0">
        <table
          data-testid="filtered-ok-rows"
          data-count={rows.length}
          className="min-w-full border-collapse text-left text-sm"
        >
          <caption className="mb-2 text-left text-xs text-stone-600">
            Row numbers are the position in the current sort, not an IQ rank.
          </caption>
          <thead className="sticky top-0 bg-white">
            {table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="border-b border-stone-300">
                {group.headers.map((header) => (
                  <th
                    key={header.id}
                    scope="col"
                    aria-sort={ariaSort(header.column.id, sort)}
                    className="whitespace-nowrap px-2 py-2.5 font-medium sm:py-2"
                    {...(header.column.id === "row_in_sort"
                      ? { "aria-label": "Row number in current sort" }
                      : {})}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => {
              const rec = row.original;
              const selected = selectedIso3 === rec.iso3;
              return (
                <tr
                  key={row.id}
                  data-iso3={rec.iso3}
                  data-status={rec.status}
                  data-quality={rec.quality ?? ""}
                  data-population={rec.population ?? ""}
                  data-selected={selected ? "true" : "false"}
                  className={`border-b border-stone-200 ${
                    selected ? "bg-amber-50" : "odd:bg-stone-50"
                  }`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="whitespace-nowrap px-2 py-2.5 sm:py-1.5">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
