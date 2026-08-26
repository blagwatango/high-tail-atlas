"use client";

import {
  MIN_POP_PRESETS,
  QUALITY_THRESHOLDS,
  SORT_KEYS,
  type QualityThreshold,
  type SortKey,
} from "@/lib/filters";

type FilterBarProps = {
  continents: string[];
  regions: string[];
  continent: string[];
  region: string[];
  minPop: number;
  quality: QualityThreshold;
  sort: SortKey;
  allowQualityD: boolean;
  onContinentChange: (next: string[]) => void;
  onRegionChange: (next: string[]) => void;
  onMinPopChange: (next: number) => void;
  onQualityChange: (next: QualityThreshold) => void;
  onSortChange: (next: SortKey) => void;
};

function toggle(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

const SORT_LABELS: Record<SortKey, string> = {
  population: "Population",
  p_hat: "Estimated share",
  name: "Name",
};

export function FilterBar({
  continents,
  regions,
  continent,
  region,
  minPop,
  quality,
  sort,
  allowQualityD,
  onContinentChange,
  onRegionChange,
  onMinPopChange,
  onQualityChange,
  onSortChange,
}: FilterBarProps) {
  const qualityOptions = QUALITY_THRESHOLDS.filter(
    (q) => q !== "D" || allowQualityD || quality === "D",
  );

  return (
    <form
      className="flex flex-col gap-4 rounded-md border border-stone-200 bg-white p-4 text-sm"
      aria-label="Filters"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1 font-medium">Continent</legend>
          <p className="mb-2 text-xs text-stone-600">
            Leave empty for all. Combined with region using AND.
          </p>
          <div className="flex max-h-32 flex-col gap-1 overflow-auto">
            {continents.map((c) => (
              <label key={c} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="continent"
                  value={c}
                  checked={continent.includes(c)}
                  onChange={() => onContinentChange(toggle(continent, c))}
                />
                {c}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-1 font-medium">Region</legend>
          <p className="mb-2 text-xs text-stone-600">
            UN M49 region. Independent of continent; both must match.
          </p>
          <div className="flex max-h-32 flex-col gap-1 overflow-auto">
            {regions.map((r) => (
              <label key={r} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="region"
                  value={r}
                  checked={region.includes(r)}
                  onChange={() => onRegionChange(toggle(region, r))}
                />
                {r}
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <div className="flex flex-wrap items-end gap-6">
        <fieldset>
          <legend className="mb-1 font-medium">Min population</legend>
          <div className="flex flex-wrap gap-1">
            {MIN_POP_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-pressed={minPop === preset.value}
                className={`rounded border px-2 py-1 ${
                  minPop === preset.value
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 bg-white hover:bg-stone-100"
                }`}
                onClick={() => onMinPopChange(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Quality threshold</span>
          <select
            className="rounded border border-stone-300 bg-white px-2 py-1"
            value={quality}
            onChange={(e) =>
              onQualityChange(e.target.value as QualityThreshold)
            }
          >
            {qualityOptions.map((q) => (
              <option key={q} value={q}>
                {q}
                {q === "C" ? " (includes U)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">Sort</span>
          <select
            className="rounded border border-stone-300 bg-white px-2 py-1"
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortKey)}
          >
            {SORT_KEYS.map((key) => (
              <option key={key} value={key}>
                {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </form>
  );
}
