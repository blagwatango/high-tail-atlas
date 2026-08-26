"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useQueryStates } from "nuqs";
import { atlasHref } from "@/lib/atlas";
import {
  compareRows,
  isDemoDataset,
  matchesFilters,
  statusLine,
  uniqueSorted,
} from "@/lib/filters";
import { formatPHat } from "@/lib/format";
import { AtlasFile } from "@/lib/schema";
import { dashboardParsers } from "@/lib/url-state";
import { FilterBar } from "./FilterBar";

const ChoroplethMap = dynamic(() => import("./ChoroplethMap"), {
  ssr: false,
  loading: () => (
    <p className="text-sm text-stone-600" data-testid="map-loading">
      Loading map…
    </p>
  ),
});

export function Dashboard() {
  const [filters, setFilters] = useQueryStates(dashboardParsers);
  const [atlas, setAtlas] = useState<AtlasFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedIso3, setSelectedIso3] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(atlasHref(), { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load estimates (${res.status})`);
        }
        const parsed = AtlasFile.parse(await res.json());
        if (!cancelled) setAtlas(parsed);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load estimates");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const continents = useMemo(
    () => uniqueSorted((atlas?.countries ?? []).map((c) => c.continent)),
    [atlas],
  );
  const regions = useMemo(
    () => uniqueSorted((atlas?.countries ?? []).map((c) => c.region_m49)),
    [atlas],
  );

  const shown = useMemo(() => {
    if (!atlas) return [];
    return atlas.countries
      .filter((row) =>
        matchesFilters(row, {
          continents: filters.continent,
          regions: filters.region,
          minPop: filters.minPop,
          quality: filters.quality,
        }),
      )
      .sort((a, b) => compareRows(a, b, filters.sort));
  }, [atlas, filters]);

  const passingIso3 = useMemo(
    () => new Set(shown.map((row) => row.iso3)),
    [shown],
  );

  const selected = useMemo(
    () => atlas?.countries.find((row) => row.iso3 === selectedIso3) ?? null,
    [atlas, selectedIso3],
  );

  if (error) {
    return (
      <p className="mt-6 text-red-800" role="alert">
        {error}
      </p>
    );
  }

  if (!atlas) {
    return (
      <p className="mt-6 text-stone-700" data-testid="dashboard-loading">
        Loading modeled estimates…
      </p>
    );
  }

  const demo = isDemoDataset(atlas.manifest);
  const line = statusLine(atlas.countries, shown);

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-3">
        {demo ? (
          <span
            data-testid="demo-badge"
            className="rounded bg-amber-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white"
          >
            DEMO DATA
          </span>
        ) : null}
        <p className="text-sm text-stone-700">
          Modeled estimates, not measurements. Dataset{" "}
          <span className="font-mono">{atlas.manifest.dataset_id}</span>.
        </p>
      </div>

      <FilterBar
        continents={continents}
        regions={regions}
        continent={filters.continent}
        region={filters.region}
        minPop={filters.minPop}
        quality={filters.quality}
        sort={filters.sort}
        allowQualityD={atlas.manifest.flags.allow_quality_d}
        onContinentChange={(continent) => void setFilters({ continent })}
        onRegionChange={(region) => void setFilters({ region })}
        onMinPopChange={(minPop) => void setFilters({ minPop })}
        onQualityChange={(quality) => void setFilters({ quality })}
        onSortChange={(sort) => void setFilters({ sort })}
      />

      <p data-testid="status-line" className="text-sm text-stone-800">
        {line}
      </p>

      <section
        aria-labelledby="map-heading"
        className="rounded-md border border-stone-200 bg-white p-4"
      >
        <h2 id="map-heading" className="text-lg font-semibold">
          Estimated share of population modeled at IQ ≥ 130
        </h2>
        <ChoroplethMap
          countries={atlas.countries}
          passingIso3={passingIso3}
          selectedIso3={selectedIso3}
          onSelect={setSelectedIso3}
        />
        {selected ? (
          <aside
            data-testid="country-drawer"
            aria-label="Country detail"
            className="mt-3 rounded border border-stone-200 bg-stone-50 p-3 text-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-medium">
                {selected.name}{" "}
                <span className="font-mono text-xs text-stone-500">
                  {selected.iso3}
                </span>
              </h3>
              <button
                type="button"
                className="rounded border border-stone-300 bg-white px-2 py-0.5 text-xs hover:bg-stone-100"
                onClick={() => setSelectedIso3(null)}
              >
                Close
              </button>
            </div>
            <p className="mt-2">
              Estimated share modeled at IQ ≥ 130:{" "}
              {formatPHat(selected.p_hat, selected.quality, "drawer")}
            </p>
            <p className="mt-1 text-stone-600">
              This is a model output, not a count.
            </p>
          </aside>
        ) : null}
      </section>

      <section
        aria-labelledby="lollipop-heading"
        className="rounded-md border border-dashed border-stone-300 bg-white p-4"
      >
        <h2 id="lollipop-heading" className="text-lg font-semibold">
          Country comparison (lollipop)
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Comparison chart of estimated shares is not in this release.
        </p>
      </section>

      <section
        aria-labelledby="table-heading"
        className="rounded-md border border-dashed border-stone-300 bg-white p-4"
      >
        <h2 id="table-heading" className="text-lg font-semibold">
          Country estimates
        </h2>
        <p className="mt-2 text-sm text-stone-600">
          Full sortable table is not in this release. Countries below pass the
          current filters (quality E omitted).
        </p>
        <ul
          data-testid="filtered-ok-rows"
          data-count={shown.length}
          className="mt-3 columns-2 gap-4 text-sm sm:columns-3"
        >
          {shown.map((row) => (
            <li
              key={row.iso3}
              data-iso3={row.iso3}
              data-status={row.status}
              data-quality={row.quality ?? ""}
              data-population={row.population ?? ""}
            >
              {row.name}{" "}
              <span className="font-mono text-xs text-stone-500">{row.iso3}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
