import { formatPHat } from "./format";
import type { CountryRecord } from "./schema";

const ADM0_RE = /^[A-Z0-9]{3}$/;
const MISSING_ISO = new Set(["", "-99", "-099", "99"]);

/** Pipeline aliases NE Kosovo ADM0_A3 `KOS` to user-assigned `XKX`. */
const GEOM_ISO3_ALIAS: Record<string, string> = { KOS: "XKX" };

export type NeProperties = {
  ISO_A3?: string | null;
  ADM0_A3?: string | null;
  NAME?: string | null;
  NAME_EN?: string | null;
};

function code(value: string | null | undefined): string | null {
  if (value == null) return null;
  const text = String(value).trim().toUpperCase();
  return text === "" ? null : text;
}

function isoA3Usable(iso: string | null): iso is string {
  return iso != null && !MISSING_ISO.has(iso) && ADM0_RE.test(iso);
}

/**
 * Join a Natural Earth polygon to CountryRecord.iso3.
 * Prefer ISO_A3; if missing/-99, use ADM0_A3; then apply the Kosovo alias.
 */
export function joinIso3(props: NeProperties): string | null {
  const iso = code(props.ISO_A3);
  const adm0 = code(props.ADM0_A3);
  let raw: string | null = null;
  if (isoA3Usable(iso)) raw = iso;
  else if (adm0 != null && ADM0_RE.test(adm0)) raw = adm0;
  if (raw == null) return null;
  return GEOM_ISO3_ALIAS[raw] ?? raw;
}

export function featureDisplayName(props: NeProperties, fallback: string): string {
  const name = props.NAME_EN?.trim() || props.NAME?.trim();
  return name || fallback;
}

export function mapTooltipText(row: CountryRecord): string {
  const qualityLabel = row.quality == null ? "no estimate" : row.quality;
  const year = row.source_year == null ? "unknown" : String(row.source_year);
  const source = row.source_short ?? row.source ?? "—";
  const share =
    row.status !== "ok"
      ? "No estimate"
      : formatPHat(row.p_hat, row.quality, "map") || "—";

  const lines = [
    row.name,
    `Estimated share modeled at PISA mathematics ≥ 700: ${share}`,
    "This is a model output, not a count.",
    `Quality: ${qualityLabel} · Source year: ${year}`,
    `Source: ${source}`,
  ];
  if (row.quality === "C") lines.push("low sample quality");
  else if (row.quality === "U") lines.push("unknown sample quality");
  else if (row.quality === "D") lines.push("Insufficient data.");
  if (
    row.status === "no_estimate" ||
    row.status === "no_iso" ||
    row.status === "excluded_territory"
  ) {
    lines.push("Not independently estimated");
  }
  return lines.join("\n");
}
