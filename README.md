# High-Tail Atlas

Modeled estimates of the share of each country’s population at IQ ≥ 130. This is **not** a ranking of people, nations, or worth. Country means are estimates; the dashboard will compute a normal right-tail probability, not a census of high-IQ people.

v1 will ship a labeled **DEMO** dataset. Do not treat demo figures as measurements.

## Requirements

- Node.js 24 (design mentioned 22 LTS; 24 is supported)
- [pnpm](https://pnpm.io) 10.x via Corepack, used **inside `web/`**
- Python 3.11+ for the pipeline

## Web app (`web/`)

Static files live at `web/public/` (sibling of `web/src/`, `web/package.json`, and `web/next.config.ts`). **Do not put `public/` inside `src/`.** Next.js App Router will not serve `web/src/public/`; that path 404s.

Enable pnpm, then install and run from `web/`:

```bash
corepack enable
corepack prepare pnpm@10.15.0 --activate
cd web
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). The site is a static export (`output: "export"`, trailing slashes).

```bash
cd web
pnpm build
```

The export is written to `web/out/`. Optional project-pages prefix: set `NEXT_PUBLIC_BASE_PATH` (for example `/high-tail-atlas`) before `pnpm build`. `next.config.ts` does not invent that variable.

## Pipeline (`pipeline/`)

ISO-3 join keys are normalized in `pipeline/src/hightail/normalize.py` using `data/overrides/iso3_overrides.yaml` (aliases, `never_map`, ISO-2 exceptions) and `data/overrides/territory_policy.yaml`. Disputed polygons do not inherit a sovereign μ (`inherit_mu_to_disputed: false`). Ingest validates a UTF-8 estimates CSV and never fills missing μ from neighbors. The build command joins UN WPP 2024 Medium 2025 headcounts, computes \(p = 1-\Phi((130-\mu)/\sigma)\), joins Natural Earth 110m geometry (`web/public/data/world-110m.topo.json`; Antarctica omitted), and writes `web/public/data/atlas.json`. Declared dependencies are in `pipeline/pyproject.toml` (`requires-python = ">=3.11"`).

```bash
cd pipeline
python -m venv .venv
.venv/Scripts/python -m pip install -e ".[dev]"   # Windows; use .venv/bin/python on Unix
.venv/Scripts/python -m pytest
python -m hightail.cli ingest --dry-run --estimates ../data/fixtures/demo_estimates.csv
python -m hightail.cli build \
  --estimates ../data/fixtures/demo_estimates.csv \
  --population ../data/raw/wpp_extract.csv \
  --overrides ../data/overrides/iso3_overrides.yaml \
  --policy ../data/overrides/territory_policy.yaml \
  --out ../web/public/data/atlas.json \
  --reference-year 2025
```

`pipeline/scripts/fetch_wpp.py` rebuilds the WPP extract from a pinned DESA Compact CSV (OWID processed WPP is the allowed fallback). This repo commits a trimmed `data/raw/wpp_extract.csv` fixture plus `data/raw/WPP_PIN.txt`.

`web/public/data/world-110m.topo.json` is Natural Earth Admin 0 Countries 1:110m (v5.1.1, public domain). Antarctica (`ATA`) is omitted. ISO_A3 `-99` features join on `ADM0_A3` with `status=no_iso`. The build fails if `n_geometry_dropped > 0`.

## Product constraints

Written in full in [`AGENTS.md`](AGENTS.md) and [`web/src/app/about/page.tsx`](web/src/app/about/page.tsx). Short version: no neighbor imputation of missing country means; no racial, ethnic, religious, or immigrant-origin choropleths; no contest-of-nations framing; do not vendor Lynn/Vanhanen/Becker national-IQ tables.
