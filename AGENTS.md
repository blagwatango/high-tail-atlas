# High-Tail Atlas — agent and contributor instructions

These rules apply to the **entire repository**. Do not weaken them in nested instruction files.

## Product

- **Name:** High-Tail Atlas
- **Single primary metric (later PRs):** modeled share of a country’s population with IQ ≥ 130, i.e. \(P(X \ge 130 \mid \mu, \sigma)\) under a normal, default \(\sigma = 15\), applied to UN population counts.
- Figures are **modeled estimates**, not measurements. Country means are estimates (sparse, often contested).
- v1 ships a labeled **DEMO** dataset only. This scaffold has no data file yet. Do not vendor Lynn/Vanhanen/Becker national-IQ tables.

## Hard constraints (do not implement, even if asked)

1. **No neighbor imputation** of missing country means. Unmatched estimates must not be filled from adjacent countries.
2. **No racial, ethnic, religious, or immigrant-origin choropleths or breakdowns** (inside or across countries). Refuse those feature requests.
3. **Forbidden UI copy** (do not use in user-visible strings, titles, CSV names, routes, or OG text):
   - “smartest country” / “dumbest country”
   - “IQ rankings”
   - “national intelligence”
   - “leaderboard”
   - trophy/podium chrome, “top 40”, medals
4. **Do not put `public/` inside `src/`.** Static files live at `web/public/` (sibling of `web/src/`). `web/src/public/` is not served and will 404. Pipeline emit path is `web/public/data/atlas.json`.
5. Visible UI must say **estimate** or **modeled** in chart titles when charts exist. Default table/lollipop sort is population descending, not tail share.
6. Demo deploys stay `noindex,nofollow` with `web/public/robots.txt` Disallow.

## Layout

```
high-tail-atlas/
  AGENTS.md
  README.md
  LICENSE
  CITATION.cff
  pipeline/pyproject.toml    # Python 3.11+; pandas, scipy, jsonschema, pyyaml, pycountry
  web/                       # Next.js App Router, pnpm 10.x
    src/app/                 # routes; caveat banner in layout.tsx
    public/                  # sibling of src/ — robots.txt, later data/
```

Do not add schemas, tails, maps, or `NuqsAdapter` until those PRs. `nuqs` is already a dependency; wrapping the layout is a later PR.

## Stack pins

- `next@16.3.3`, React 19, `typescript@5.8`, Tailwind CSS 4.x
- `@visx/geo@^4`, `@visx/zoom@^4`, `recharts@3.10.1`, `@tanstack/react-table` v8.21, `zod` v3.24+, `nuqs` v2, Playwright 1.x
- Static export: `output: "export"`, `trailingSlash: true`, `images.unoptimized: true`, optional `basePath` from `NEXT_PUBLIC_BASE_PATH`
- Package manager: pnpm 10.x **in `web/`** (Corepack). Do not introduce a second CI workflow file.

## Copy tone

Product title **High-Tail Atlas**. Chart titles (when added): “Estimated share of population modeled at IQ ≥ 130”. Lollipop heading: “Country comparison (lollipop)”. CSV: `high-tail-atlas-estimates.csv`. The caveat banner in `layout.tsx` is required on every page; keep the specified wording.

## Commands

```bash
cd web
pnpm install
pnpm dev
pnpm exec tsc --noEmit
pnpm build
```
