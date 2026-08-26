"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  type BarShapeProps,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  type ScatterShapeProps,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { COLOR_SWATCH_BORDER, REFERENCE_P, REFERENCE_P_LABEL } from "@/lib/colors";
import { compareRows, type SortKey } from "@/lib/filters";
import { formatPHat } from "@/lib/format";
import {
  capLollipopRows,
  isDottedStem,
  isHollowHead,
  LOLLIPOP_AXIS_TITLE,
  LOLLIPOP_CAP,
  LOLLIPOP_CAP_LABEL,
  LOLLIPOP_TITLE,
  showAllCountriesLabel,
  toLollipopRows,
  type LollipopRow,
} from "@/lib/lollipop";
import { pPct } from "@/lib/pct";
import type { CountryRecord, Quality } from "@/lib/schema";

const STEM_STROKE = COLOR_SWATCH_BORDER;
const HEAD_RADIUS = 5;
const ROW_PX = 28;
const CHART_PAD_PX = 80;

function qualityCaveat(quality: Quality | null): string | null {
  switch (quality) {
    case "C":
      return "low sample quality";
    case "U":
      return "unknown sample quality";
    case "D":
      return "Insufficient data.";
    default:
      return null;
  }
}

function formatEstimatedN(n: number | null): string | null {
  if (n == null) return null;
  if (n < 1) return "<1";
  return `~${n.toLocaleString("en-US")}`;
}

function xDomainMax(dataMax: number): number {
  const peak = Number.isFinite(dataMax) ? dataMax : 0;
  return Math.max(peak, pPct(REFERENCE_P)) * 1.06;
}

function LollipopStem(props: BarShapeProps) {
  const { x, y, width, height, payload } = props;
  const row = payload as LollipopRow | undefined;
  if (row == null || width == null || height == null) return <g />;
  const cy = y + height / 2;
  return (
    <line
      x1={x}
      y1={cy}
      x2={x + width}
      y2={cy}
      stroke={STEM_STROKE}
      strokeWidth={2}
      strokeDasharray={isDottedStem(row.quality) ? "2 2" : undefined}
    />
  );
}

function LollipopHead(
  props: ScatterShapeProps & { onSelectIso3?: (iso3: string) => void },
) {
  const { cx, cy, payload, onSelectIso3 } = props;
  const row = payload as LollipopRow | undefined;
  if (cx == null || cy == null || row == null) return <g />;
  const hollow = isHollowHead(row.quality);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={HEAD_RADIUS}
      fill={hollow ? "#ffffff" : row.fill}
      stroke={row.fill}
      strokeWidth={hollow ? 2 : 1}
      style={{ cursor: "pointer" }}
      data-testid="lollipop-head"
      data-iso3={row.iso3}
      data-quality={row.quality ?? ""}
      onClick={() => onSelectIso3?.(row.iso3)}
    />
  );
}

function EstimateTooltip({ active, payload }: TooltipContentProps) {
  if (!active || payload.length === 0) return null;
  const row = payload[0]?.payload as LollipopRow | undefined;
  if (row == null) return null;
  const caveat = qualityCaveat(row.quality);
  const nLabel = formatEstimatedN(row.estimated_n_ge_130);
  return (
    <div className="max-w-xs rounded border border-stone-300 bg-white p-2 text-xs text-stone-900 shadow">
      <p className="font-medium">{row.name}</p>
      <p>
        Estimated share modeled at IQ ≥ 130:{" "}
        {formatPHat(row.p_hat, row.quality, "map")}
      </p>
      <p>This is a model output, not a count.</p>
      <p>
        Quality: {row.quality ?? "no estimate"} · Source year:{" "}
        {row.source_year ?? "unknown"}
      </p>
      <p>Source: {row.source_short ?? "unknown"}</p>
      {caveat ? <p>{caveat}</p> : null}
      {nLabel ? (
        <p>Est. people ≥ 130 (context): {nLabel}</p>
      ) : null}
    </div>
  );
}

function iso3FromChartClick(data: unknown): string | null {
  if (data == null || typeof data !== "object") return null;
  const rec = data as { iso3?: unknown; payload?: { iso3?: unknown } };
  if (typeof rec.iso3 === "string") return rec.iso3;
  if (typeof rec.payload?.iso3 === "string") return rec.payload.iso3;
  return null;
}

type LollipopChartProps = {
  countries: CountryRecord[];
  sort: SortKey;
  selectedIso3?: string | null;
  onSelectIso3?: (iso3: string) => void;
};

export function LollipopChart({
  countries,
  sort,
  selectedIso3,
  onSelectIso3,
}: LollipopChartProps) {
  const [showAll, setShowAll] = useState(false);

  const rows = useMemo(() => {
    const mapped = toLollipopRows(countries);
    mapped.sort((a, b) => compareRows(a, b, sort));
    return mapped;
  }, [countries, sort]);

  const visible = capLollipopRows(rows, showAll);
  const n = rows.length;
  const height = Math.max(240, visible.length * ROW_PX + CHART_PAD_PX);
  const capCaption =
    n > LOLLIPOP_CAP && showAll
      ? `Showing all ${n} countries in current sort.`
      : LOLLIPOP_CAP_LABEL;

  return (
    <div data-testid="lollipop">
      <h2 id="lollipop-heading" className="text-lg font-semibold">
        {LOLLIPOP_TITLE}
      </h2>
      {n === 0 ? (
        <p className="mt-2 text-sm text-stone-600">
          No countries match the current filters.
        </p>
      ) : (
        <>
          <p data-testid="lollipop-cap" className="mt-2 text-sm text-stone-700">
            {capCaption}
          </p>
          {n > LOLLIPOP_CAP ? (
            <button
              type="button"
              data-testid="lollipop-show-all"
              className="mt-1 text-sm text-stone-800 underline underline-offset-2"
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll
                ? "Show 40 countries in current sort."
                : showAllCountriesLabel(n)}
            </button>
          ) : null}
          <div className="mt-3 w-full" style={{ height }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                layout="vertical"
                data={visible}
                margin={{ top: 16, right: 36, bottom: 48, left: 120 }}
                barCategoryGap={8}
                style={{ cursor: "pointer" }}
                onClick={(state) => {
                  const index =
                    typeof state.activeIndex === "number"
                      ? state.activeIndex
                      : typeof state.activeIndex === "string"
                        ? Number(state.activeIndex)
                        : Number.NaN;
                  if (Number.isInteger(index) && visible[index]) {
                    onSelectIso3?.(visible[index].iso3);
                    return;
                  }
                  const label = state.activeLabel;
                  if (typeof label === "string") {
                    const row = visible.find((r) => r.name === label);
                    if (row) onSelectIso3?.(row.iso3);
                  }
                }}
              >
                <XAxis
                  type="number"
                  domain={[0, xDomainMax]}
                  tickFormatter={(v: number) => `${v}%`}
                  height={48}
                  label={{
                    value: LOLLIPOP_AXIS_TITLE,
                    position: "bottom",
                    style: { fontSize: 12, fill: "#1c1917" },
                  }}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  interval={0}
                  tick={{ fontSize: 11, fill: "#1c1917" }}
                />
                <ReferenceLine
                  x={pPct(REFERENCE_P)}
                  stroke={STEM_STROKE}
                  strokeDasharray="4 4"
                  label={REFERENCE_P_LABEL}
                />
                <Bar
                  dataKey="p_pct"
                  barSize={2}
                  legendType="none"
                  isAnimationActive={false}
                  shape={LollipopStem}
                  onClick={(data) => {
                    const iso3 = iso3FromChartClick(data);
                    if (iso3) onSelectIso3?.(iso3);
                  }}
                />
                <Scatter
                  dataKey="p_pct"
                  legendType="none"
                  isAnimationActive={false}
                  shape={(props) => (
                    <LollipopHead {...props} onSelectIso3={onSelectIso3} />
                  )}
                  onClick={(data) => {
                    const iso3 = iso3FromChartClick(data);
                    if (iso3) onSelectIso3?.(iso3);
                  }}
                />
                <Tooltip
                  content={EstimateTooltip}
                  cursor={{ fill: "#f5f5f4" }}
                  isAnimationActive={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <ol className="sr-only" data-testid="lollipop-rows">
            {visible.map((row) => (
              <li
                key={row.iso3}
                data-iso3={row.iso3}
                data-p-pct={row.p_pct}
                data-quality={row.quality ?? ""}
                data-selected={selectedIso3 === row.iso3 ? "true" : "false"}
              >
                <button type="button" onClick={() => onSelectIso3?.(row.iso3)}>
                  {row.name}: {formatPHat(row.p_hat, row.quality, "map")}
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
