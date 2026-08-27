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
import { AtlasFile } from "@/lib/schema";
import { dashboardParsers } from "@/lib/url-state";
import { CountryDrawer } from "./CountryDrawer";
import { CountryTable } from "./CountryTable";
import { FilterBar } from "./FilterBar";
import { LollipopChart } from "./LollipopChart";

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

  const popYear = useMemo(() => {
    const years = new Set(
      shown
        .map((row) => row.pop_year)
        .filter((year): year is number => year != null),
    );
    return years.size === 1 ? [...years][0] : null;
  }, [shown]);

  if (error) {
    return (
      <div className="mt-6">
        <p className="text-red-800" role="alert">
          {error}
        </p>
        <section
          id="country-table"
          tabIndex={-1}
          aria-labelledby="table-heading"
          className="mt-6"
        >
          <h2 id="table-heading" className="text-lg font-semibold">
            Country estimates
          </h2>
        </section>
      </div>
    );
  }

  if (!atlas) {
    return (
      <div className="mt-6">
        <p className="text-stone-700" data-testid="dashboard-loading">
          Loading modeled estimates…
        </p>
        <section
          id="country-table"
          tabIndex={-1}
          aria-labelledby="table-heading"
          className="mt-6"
        >
          <h2 id="table-heading" className="text-lg font-semibold">
            Country estimates
          </h2>
        </section>
      </div>
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
            className="rounded bg-amber-800 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white"
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

      <CountryDrawer
        country={selected}
        onClose={() => setSelectedIso3(null)}
      />

      <section
        aria-labelledby="map-heading"
        className="rounded-md border border-stone-200 bg-white p-4"
      >
        <h2 id="map-heading" className="text-lg font-semibold">
          {atlas.manifest.metric_label}
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Visual overview. Keyboard path:{" "}
          <a href="#country-table" className="underline underline-offset-2">
            country estimates table
          </a>
          .
        </p>
        <ChoroplethMap
          countries={atlas.countries}
          passingIso3={passingIso3}
          selectedIso3={selectedIso3}
          onSelect={setSelectedIso3}
        />
      </section>

      <section
        aria-labelledby="lollipop-heading"
        className="rounded-md border border-dashed border-stone-300 bg-white p-4"
      >
        <LollipopChart
          countries={shown}
          sort={filters.sort}
          selectedIso3={selectedIso3}
          onSelectIso3={setSelectedIso3}
        />
      </section>

      <section
        id="country-table"
        tabIndex={-1}
        aria-labelledby="table-heading"
        className="rounded-md border border-stone-200 bg-white p-4"
      >
        <h2 id="table-heading" className="text-lg font-semibold">
          Country estimates
        </h2>
        <div className="mt-3">
          <CountryTable
            rows={shown}
            sort={filters.sort}
            datasetId={atlas.manifest.dataset_id}
            popYear={popYear}
            selectedIso3={selectedIso3}
            onSortChange={(next) => void setFilters({ sort: next })}
            onSelectIso3={setSelectedIso3}
          />
        </div>
      </section>
    </div>
  );
}
