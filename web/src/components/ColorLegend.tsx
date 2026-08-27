import {
  COLOR_FILTERED,
  COLOR_NO_DATA,
  COLOR_SWATCH_BORDER,
  P_BINS,
  REFERENCE_P,
  REFERENCE_P_LABEL,
} from "@/lib/colors";
import { MAP_CAPTION } from "@/lib/copy";

const SWATCH = 14;

function Swatch({
  fill,
  hatch,
  label,
}: {
  fill: string;
  hatch?: "no-data" | "sparse";
  label: string;
}) {
  const patternId = hatch === "no-data" ? "legend-hatch-nodata" : "legend-hatch-sparse";
  return (
    <svg
      width={SWATCH}
      height={SWATCH}
      aria-hidden="true"
      className="shrink-0"
    >
      <title>{label}</title>
      <rect
        width={SWATCH}
        height={SWATCH}
        fill={fill}
        stroke={COLOR_SWATCH_BORDER}
        strokeWidth={1}
      />
      {hatch ? (
        <rect
          width={SWATCH}
          height={SWATCH}
          fill={`url(#${patternId})`}
          stroke={COLOR_SWATCH_BORDER}
          strokeWidth={1}
        />
      ) : null}
    </svg>
  );
}

export function ColorLegend() {
  return (
    <figure data-testid="color-legend" className="mt-3 text-xs text-stone-700">
      <svg width={0} height={0} aria-hidden="true" className="absolute">
        <defs>
          <pattern
            id="legend-hatch-nodata"
            patternUnits="userSpaceOnUse"
            width="4"
            height="4"
            patternTransform="rotate(45)"
          >
            <line x1="0" y1="0" x2="0" y2="4" stroke="#6b7280" strokeWidth="1.2" />
          </pattern>
          <pattern
            id="legend-hatch-sparse"
            patternUnits="userSpaceOnUse"
            width="6"
            height="6"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="6"
              stroke="#4b5563"
              strokeWidth="0.8"
              strokeOpacity="0.45"
            />
          </pattern>
        </defs>
      </svg>
      <figcaption className="mb-2 max-w-xl leading-snug">
        {MAP_CAPTION} +2 SD is a thin slice; hatched gray is no estimate.
      </figcaption>
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <li className="flex items-center gap-1.5">
          <Swatch fill={COLOR_NO_DATA} hatch="no-data" label="No estimate" />
          No estimate
        </li>
        <li className="flex items-center gap-1.5">
          <Swatch fill={COLOR_FILTERED} label="Hidden by filters" />
          Hidden by filters
        </li>
        {P_BINS.map((bin, i) => {
          const lo = i === 0 ? 0 : P_BINS[i - 1].maxExclusive;
          const marksReference = REFERENCE_P >= lo && REFERENCE_P < bin.maxExclusive;
          return (
            <li key={bin.label} className="flex items-center gap-1.5">
              <Swatch fill={bin.fill} label={bin.label} />
              <span>{bin.label}</span>
              {marksReference ? (
                <span className="text-stone-500">
                  μ=500, σ=100 → {REFERENCE_P_LABEL}.
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
