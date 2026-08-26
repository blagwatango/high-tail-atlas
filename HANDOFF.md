# Session handoff — High-Tail Atlas

**Date:** 2026-08-26  
**Status:** v1 dashboard implemented locally. Not on GitHub. New session must re-check GitHub identity, then create `blagwatango/high-tail-atlas` and push.

This file is the onboarding brief for the next Grok session. Read it first. Then read `docs/design.md` (approved design) and `AGENTS.md` (product constraints).

---

## Why a new session

The previous Grok GitHub MCP was authenticated as **`mrtully-bot`** (`https://github.com/mrtully-bot`). The user wants **`blagwatango`** (`https://github.com/blagwatango`). Browser login as blagwatango does not replace an already-running MCP token. A **new Grok session** is required after `/mcps` re-auth (press `i` on GitHub, authorize **blagwatango**).

**First action in the new session:** call GitHub `get_me`. Expected: `login: blagwatango`. If it still says `mrtully-bot`, stop and tell the user re-auth did not stick.

Do **not** create the repo under `mrtully-bot`.

---

## Where the work lives (do not lose this)

| What | Path |
|---|---|
| Git repo | `C:\Users\mrtul\Projects\high-tail-atlas` |
| Complete branch | `high-tail-atlas` |
| Tip commit | `edf0fc45c29645e3c995484e93f82e6b759ef090` — `docs: session handoff and approved design document` (parent `fbd2a2d` is the complete product merge) |
| `main` | empty initial commit only (`3d56b15`) — **do not reset this branch onto main without asking** |
| Remote | **none** (`git remote -v` is empty) |
| Design doc | `docs/design.md` (copied from the design-skill scratch file) |
| Local git author | `Watango` / `Watango@Protonmail.com` |

Workspace in the old chat was `C:\` (drive root). Always `cd` to the repo above. Do not `git init` at `C:\`.

Execute-plan worktrees under `%TEMP%\grok-Watango\wt-pr-*` are leftovers. The assembled product is the `high-tail-atlas` branch in the main repo. Prefer that checkout.

---

## What was built

Greenfield static dashboard. **Single primary metric:** modeled share of each country’s population with IQ ≥ 130:

```
p_hat = 1 - Φ((130 - μ) / σ)     # scipy.stats.norm.sf; default σ = 15
```

This is a **model**, not a census. Country IQ means are estimates with provenance. v1 ships a labeled **DEMO** fixture only (quality C, μ ∈ {90, 100, 110}). Lynn/Becker tables are **not** vendored.

Shipped surfaces:

- Equal Earth choropleth (`@visx/geo` v4, `projection="equalEarth"`)
- Country comparison lollipop (Recharts; **not** a “rankings” heading; default sort = population)
- Sortable table + CSV `high-tail-atlas-estimates.csv`
- Country drawer with `tailP` formula, SE or ±3 sensitivity band
- `/methodology` calculator, `/data`, `/about`
- Caveat banner (required copy in design), DEMO badge, `noindex` + `robots.txt` Disallow
- Python pipeline: ingest → ISO normalize → tails → WPP join → Natural Earth 110m → `web/public/data/atlas.json`
- Legal-gated Becker/PISA adapters (refuse without `HIGHTAIL_ADAPTER_LICENSE_OK` + local file)

Forbidden UI copy: `smartest`, `dumbest` (except ethical refusal), `national intelligence`, `IQ rank`, `leaderboard`, visible “Ranked lollipop” / “top 40”. CI script: `web/scripts/audit-ui-copy.mjs`.

Stack: Next.js 16.3.3 `output: "export"`, React 19, TypeScript 5.8.3, Tailwind 4, pnpm 10 in `web/`, Python ≥3.11 pipeline.

---

## How to run (verify before pushing)

```powershell
cd C:\Users\mrtul\Projects\high-tail-atlas
git checkout high-tail-atlas
git log -1 --oneline
# expect: edf0fc4 docs: session handoff and approved design document

cd web
corepack prepare pnpm@10.15.0 --activate
pnpm install
pnpm dev
```

Open http://localhost:3000 — map should color ≥1 demo country; banner must say modeled estimates.

Rebuild artifact:

```powershell
cd C:\Users\mrtul\Projects\high-tail-atlas\web
pnpm pipeline
pnpm build
pnpm check:sizes
```

---

## Next work (the reason for the new session)

1. Confirm GitHub `get_me` is `blagwatango`.
2. Create public or private repo **`blagwatango/high-tail-atlas`** (ask if visibility is unclear; default **public** unless user says otherwise).
3. Add remote and push **`high-tail-atlas`** (and optionally set `main` to this tip after asking):

```powershell
cd C:\Users\mrtul\Projects\high-tail-atlas
git remote add origin https://github.com/blagwatango/high-tail-atlas.git
git push -u origin high-tail-atlas
```

GitHub MCP in the old session could create repos as the authenticated user. Use that if `gh` is still missing (`gh` was not installed on this machine).

4. Do not push Lynn/Becker data. Demo CSV + `atlas.json` from the demo fixture is OK (fabricated μ, DEMO badge).

---

## Design / product decisions already signed off

- Product name: **High-Tail Atlas**
- Estimates provider v1: **demo only**
- Geometry: Natural Earth **de facto**
- Contested NIQ tables: not until legal review
- No neighbor imputation, no racial/ethnic maps
- Static export; `web/public/` sibling of `web/src/` (never `src/public`)
- `NEXT_PUBLIC_BASE_PATH` is the single source for `basePath` + `atlasHref()`

Full spec: `docs/design.md`.

---

## Prompt for the new session (paste this)

```
Continue High-Tail Atlas from the local repo. Do not start over.

1. Read C:\Users\mrtul\Projects\high-tail-atlas\HANDOFF.md and docs/design.md.
2. Call GitHub get_me. If login is not blagwatango, stop.
3. Working tree: C:\Users\mrtul\Projects\high-tail-atlas branch high-tail-atlas (tip edf0fc4).
4. Create github.com/blagwatango/high-tail-atlas and push this branch. Do not use mrtully-bot as owner.
5. Confirm the remote and the GitHub URL when done.
```
