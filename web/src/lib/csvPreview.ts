import { EstimateRow } from "./schema";
import { DEFAULT_SIGMA, tailP } from "./tails";

const FORBIDDEN_PERSON_COLS = new Set(["age", "sex", "race"]);
const MAX_PREVIEW_ROWS = 400;

export const ESTIMATES_CSV_COLUMNS: readonly {
  name: string;
  required: boolean;
  notes: string;
}[] = [
  {
    name: "iso3",
    required: false,
    notes: "ISO 3166-1 alpha-3. Required if name is omitted.",
  },
  {
    name: "name",
    required: false,
    notes: "Country name. Required if iso3 is omitted. Mapped via iso3_overrides.yaml.",
  },
  {
    name: "mu",
    required: true,
    notes: "Estimated country mean. Must be in (50, 130).",
  },
  {
    name: "sigma",
    required: false,
    notes: "SD if published. Must be in (5, 30). Default 15 (assumed_15).",
  },
  {
    name: "mu_se",
    required: false,
    notes: "SE of the mean, if the source reports one.",
  },
  { name: "source", required: false, notes: "Short provenance label." },
  { name: "source_url", required: false, notes: "https URL, or empty." },
  { name: "source_year", required: false, notes: "Integer 1900–2026." },
  { name: "sample_n", required: false, notes: "Positive integer." },
  {
    name: "sample_type",
    required: false,
    notes: "adult_representative | students | children | urban | clinical | convenience | imputed | unknown.",
  },
  {
    name: "quality",
    required: false,
    notes: "A–E or U. Pipeline may only downgrade.",
  },
  { name: "notes", required: false, notes: "Free text; empty cells omitted." },
];

export type PreviewRow = {
  iso3: string | null;
  name: string | null;
  mu: number | null;
  sigma: number | null;
  sigmaAssumed: boolean;
  pHat: number | null;
  error: string | null;
};

export type PreviewResult = {
  rows: PreviewRow[];
  errors: string[];
};

/** RFC 4180-ish split: commas, double-quoted fields, escaped quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function cell(values: string[], headers: string[], key: string): string {
  const i = headers.indexOf(key);
  if (i < 0) return "";
  return (values[i] ?? "").trim();
}

function toNumber(raw: string): number | undefined {
  if (raw === "") return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Browser-only estimates preview. Not the published artifact: Python still
 * owns ingest, ISO join, WPP, and p_hat written to atlas.json.
 */
export function parsePreviewCsv(text: string): PreviewResult {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (lines.length < 2) {
    return {
      rows: [],
      errors: ["CSV needs a header row and at least one data row."],
    };
  }

  const headerLabels = splitCsvLine(lines[0]!).map((h) => h.trim());
  const headers = headerLabels.map((h) => h.toLowerCase());
  if (headers.some((h) => FORBIDDEN_PERSON_COLS.has(h))) {
    return {
      rows: [],
      errors: [
        "This preview rejects person-level columns (age, sex, race). Country-level estimates only.",
      ],
    };
  }

  const body = lines.slice(1);
  if (body.length > MAX_PREVIEW_ROWS) {
    return {
      rows: [],
      errors: [`Preview is limited to ${MAX_PREVIEW_ROWS} country rows.`],
    };
  }

  const rows: PreviewRow[] = [];
  const errors: string[] = [];

  body.forEach((line, idx) => {
    const values = splitCsvLine(line);
    const iso3Raw = cell(values, headers, "iso3").toUpperCase();
    const nameRaw = cell(values, headers, "name");
    const muRaw = cell(values, headers, "mu");
    const sigmaRaw = cell(values, headers, "sigma");

    const candidate: Record<string, unknown> = {};
    if (iso3Raw) candidate.iso3 = iso3Raw;
    if (nameRaw) candidate.name = nameRaw;
    const mu = toNumber(muRaw);
    if (mu !== undefined) candidate.mu = mu;
    const sigmaProvided = toNumber(sigmaRaw);
    if (sigmaProvided !== undefined) candidate.sigma = sigmaProvided;

    const parsed = EstimateRow.safeParse(candidate);
    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message ?? "invalid row";
      const label = iso3Raw || nameRaw || `row ${idx + 2}`;
      errors.push(`${label}: ${msg}`);
      rows.push({
        iso3: iso3Raw || null,
        name: nameRaw || null,
        mu: mu ?? null,
        sigma: sigmaProvided ?? null,
        sigmaAssumed: sigmaProvided === undefined,
        pHat: null,
        error: msg,
      });
      return;
    }

    const row = parsed.data;
    const sigma = row.sigma ?? DEFAULT_SIGMA;
    rows.push({
      iso3: row.iso3 ?? null,
      name: row.name ?? null,
      mu: row.mu,
      sigma,
      sigmaAssumed: row.sigma === undefined,
      pHat: tailP(row.mu, sigma),
      error: null,
    });
  });

  return { rows, errors };
}
