"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EqualEarth, Graticule } from "@visx/geo";
import { Zoom } from "@visx/zoom";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import { worldTopoHref } from "@/lib/atlas";
import {
  choroplethFill,
  choroplethFillKind,
  choroplethHatch,
} from "@/lib/colors";
import {
  featureDisplayName,
  joinIso3,
  mapTooltipText,
  type NeProperties,
} from "@/lib/geo";
import type { CountryRecord } from "@/lib/schema";
import { ColorLegend } from "./ColorLegend";

type WorldTopology = Topology<{
  countries: GeometryCollection<NeProperties>;
}>;

type CountryFeature = Feature<Geometry, NeProperties>;

const STROKE = "rgba(75, 85, 99, 0.4)";
const SELECTED_STROKE = "#1c1917";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setWidth(next);
    });
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  return { ref, width };
}

function toFeatures(topo: WorldTopology): CountryFeature[] {
  const fc = feature(topo, topo.objects.countries) as FeatureCollection<
    Geometry,
    NeProperties
  >;
  return fc.features;
}

function stubRecord(iso3: string, props: NeProperties): CountryRecord {
  return {
    iso3,
    name: featureDisplayName(props, iso3),
    continent: null,
    region_m49: null,
    mu: null,
    sigma: null,
    sigma_source: null,
    sigma_flag: null,
    mu_se: null,
    p_hat: null,
    p_lo_pm3: null,
    p_hi_pm3: null,
    p_lo_se: null,
    p_hi_se: null,
    population: null,
    pop_year: null,
    estimated_n_ge_130: null,
    quality: null,
    source: null,
    source_short: null,
    source_url: null,
    source_year: null,
    sample_n: null,
    sample_type: null,
    notes: null,
    status: "no_estimate",
    has_geometry: true,
    tiny_population: false,
  };
}

export type ChoroplethMapProps = {
  countries: CountryRecord[];
  passingIso3: ReadonlySet<string>;
  selectedIso3: string | null;
  onSelect: (iso3: string) => void;
};

export function ChoroplethMap({
  countries,
  passingIso3,
  selectedIso3,
  onSelect,
}: ChoroplethMapProps) {
  const { ref, width } = useWidth<HTMLDivElement>();
  const height = Math.max(Math.round(width * 0.52), 240);
  const [features, setFeatures] = useState<CountryFeature[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    text: string;
  } | null>(null);

  const byIso3 = useMemo(() => {
    const map = new Map<string, CountryRecord>();
    for (const row of countries) map.set(row.iso3, row);
    return map;
  }, [countries]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(worldTopoHref(), { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to load map geometry (${res.status})`);
        }
        const topo = (await res.json()) as WorldTopology;
        if (!cancelled) setFeatures(toFeatures(topo));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load map");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <p className="text-sm text-red-800" role="alert">
        {error}
      </p>
    );
  }

  return (
    <div ref={ref} className="relative w-full" data-testid="choropleth-map">
      {width < 16 || features == null ? (
        <p className="text-sm text-stone-600" data-testid="map-loading">
          Loading map…
        </p>
      ) : (
        <Zoom<SVGSVGElement>
          width={width}
          height={height}
          scaleXMin={1}
          scaleXMax={12}
          scaleYMin={1}
          scaleYMax={12}
        >
          {(zoom) => (
            <>
              <svg
                width={width}
                height={height}
                viewBox={`0 0 ${width} ${height}`}
                role="img"
                aria-label="World map of modeled share of population at IQ ≥ 130"
                style={{
                  cursor: zoom.isDragging ? "grabbing" : "grab",
                  touchAction: "none",
                  display: "block",
                }}
                ref={zoom.containerRef}
                onMouseLeave={() => setTooltip(null)}
              >
                <defs>
                  <pattern
                    id="hta-hatch-nodata"
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
                      stroke="#6b7280"
                      strokeWidth="1.25"
                    />
                  </pattern>
                  <pattern
                    id="hta-hatch-sparse"
                    patternUnits="userSpaceOnUse"
                    width="8"
                    height="8"
                    patternTransform="rotate(45)"
                  >
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="8"
                      stroke="#4b5563"
                      strokeWidth="0.9"
                      strokeOpacity="0.4"
                    />
                  </pattern>
                </defs>
                <rect
                  width={width}
                  height={height}
                  fill="#fafaf9"
                  onMouseMove={() => setTooltip(null)}
                />
                <g transform={zoom.toString()}>
                  <EqualEarth<CountryFeature>
                    data={features}
                    fitExtent={[
                      [
                        [8, 8],
                        [width - 8, height - 8],
                      ],
                      {
                        type: "FeatureCollection",
                        features,
                      } as unknown as CountryFeature,
                    ]}
                  >
                    {({ features: projected, path }) => (
                      <g>
                        <Graticule
                          graticule={(g) => path(g) || ""}
                          stroke="#e7e5e4"
                          strokeWidth={0.5}
                        />
                        {projected.map(({ feature: feat, path: d }, i) => {
                          if (!d) return null;
                          const iso3 = joinIso3(feat.properties ?? {});
                          if (iso3 == null) return null;
                          const row =
                            byIso3.get(iso3) ??
                            stubRecord(iso3, feat.properties ?? {});
                          const filteredOut = !passingIso3.has(row.iso3);
                          const fillOpts = {
                            pHat: row.p_hat,
                            status: row.status,
                            filteredOut,
                          };
                          const fill = choroplethFill(fillOpts);
                          const fillKind = choroplethFillKind(fillOpts);
                          const hatch = choroplethHatch({
                            status: row.status,
                            quality: row.quality,
                            filteredOut,
                          });
                          const selected = selectedIso3 === row.iso3;
                          const tip = mapTooltipText(row);
                          return (
                            <g key={`${row.iso3}-${i}`}>
                              <path
                                d={d}
                                fill={fill}
                                stroke={selected ? SELECTED_STROKE : STROKE}
                                strokeWidth={selected ? 1.25 : 0.5}
                                data-iso3={row.iso3}
                                data-fill-kind={fillKind}
                                data-fill={fill}
                                data-hatch={hatch}
                                onMouseMove={(event) => {
                                  const box = ref.current?.getBoundingClientRect();
                                  setTooltip({
                                    x: event.clientX - (box?.left ?? 0) + 12,
                                    y: event.clientY - (box?.top ?? 0) + 12,
                                    text: tip,
                                  });
                                }}
                                onClick={() => {
                                  if (zoom.isDragging) return;
                                  onSelect(row.iso3);
                                }}
                              />
                              {hatch !== "none" ? (
                                <path
                                  d={d}
                                  fill={
                                    hatch === "no-data"
                                      ? "url(#hta-hatch-nodata)"
                                      : "url(#hta-hatch-sparse)"
                                  }
                                  pointerEvents="none"
                                />
                              ) : null}
                            </g>
                          );
                        })}
                      </g>
                    )}
                  </EqualEarth>
                </g>
              </svg>
              <button
                type="button"
                className="absolute top-2 right-2 rounded border border-stone-300 bg-white px-2 py-1 text-xs text-stone-800 hover:bg-stone-100"
                onClick={() => zoom.reset()}
              >
                Reset map
              </button>
            </>
          )}
        </Zoom>
      )}
      {tooltip ? (
        <div
          role="tooltip"
          data-testid="map-tooltip"
          className="pointer-events-none absolute z-10 max-w-xs rounded border border-stone-300 bg-white px-2 py-1.5 text-xs leading-snug whitespace-pre-line text-stone-900 shadow-sm"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {tooltip.text}
        </div>
      ) : null}
      <ColorLegend />
    </div>
  );
}

export default ChoroplethMap;
