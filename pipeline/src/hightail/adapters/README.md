# Post-v1 source adapters (legal-review gate)

These adapters are **not v1 default data**. The shipped dashboard uses the
labeled DEMO fixture and a bring-your-own estimates CSV. Lynn/Vanhanen,
Becker NIQ, World Population Review re-publishes, and similar tables are
**never vendored in git**.

Adapters refuse to run unless **both** are true:

1. `HIGHTAIL_ADAPTER_LICENSE_OK=1` (or `--license-ok`)
2. A **local, uncommitted** source file path (`--source`)

They **never download** contested tables. Passing a URL is an error.

```text
# Blocked (expected):
python -m hightail.cli adapter becker --source /path/to/local.csv

# Only after legal review, local file in hand:
# POSIX:  export HIGHTAIL_ADAPTER_LICENSE_OK=1
# PowerShell:  $env:HIGHTAIL_ADAPTER_LICENSE_OK=1
python -m hightail.cli adapter becker --source /path/to/local.csv
python -m hightail.cli adapter pisa --source /path/to/local.csv
```

## License checklist (required before unblocking)

Do not set the env var in CI. Work through this list with legal, not ad hoc:

- [ ] Redistribution / use of the local source file has been reviewed (copyright, terms of use, database rights).
- [ ] The file is **not** committed. `git status` is clean of `data/raw/` IQ/NIQ extracts. Patterns such as `data/raw/*iq*` are gitignored.
- [ ] `HIGHTAIL_ADAPTER_LICENSE_OK=1` is set only in a private operator environment, never in `.github/workflows`.
- [ ] Becker neighbor-imputed rows leave the adapter as `quality=D`, `sample_type=imputed` (dropped by the default quality threshold C).
- [ ] PISA output sets `manifest.metric_label` away from “Estimated share modeled at IQ ≥ 130” and does **not** call PISA “IQ”.
- [ ] World Population Review “IQ by country” pages are **not** used (no adapter).
- [ ] Any emitted estimates CSV stays local; it is not the v1 default and is not checked in.
- [ ] Citations below are included with any public artifact that ever uses these sources.

## What each adapter is

| Adapter | What it actually is | Policy if unblocked |
|---|---|---|
| `becker.py` | Compiled test means in the Lynn/Vanhanen lineage (viewoniq.org / Becker NIQ updates). Scientifically contested. | Neighbor-imputed rows → `quality=D`, `sample_type=imputed`. Do not commit the raw table. |
| `pisa.py` | OECD PISA country means: **scholastic achievement**, not IQ. | Relabel `metric_label` to a PISA threshold. Do not silently treat PISA as IQ. Affine map onto the pipeline tail formula is a z-score convenience, not a national-IQ estimate. |
| World Population Review | Unsourced re-publish | **Do not adapter.** |

## Citations (required context, not an endorsement)

- EHBEA (2020). Statement on National IQ Datasets. https://www.ehbea.org/pages/national-iq-datasets
- Sear, R. (2022). ‘National IQ’ datasets do not provide accurate, unbiased or comparable measures of cognitive ability worldwide. https://www.researchgate.net/publication/360665701
- Wicherts, J. M., Dolan, C. V., & van der Maas, H. L. J. (2010). A systematic literature review of the average IQ of sub-Saharan Africans. *Intelligence*.
- OECD. PISA 2022 Results (only if the PISA adapter is used).
- Warne, R. T. (related reviews of Lynn & Becker NIQ construction).
- Retraction Watch (2025). Coverage of retractions tied to national-IQ database use. https://retractionwatch.com/2025/11/25/meet-the-researcher-aiming-to-halt-use-of-fundamentally-flawed-database-linking-iq-and-nationality/

Cite this software and its `dataset_id` (see `CITATION.cff`). Do not cite High-Tail Atlas as a national-IQ compilation.

## Raw sources stay uncommitted

Put operator extracts under `data/raw/` if needed. The root `.gitignore` drops `data/raw/*iq*` and similar names so Becker/Lynn tables cannot sneak into a commit. Never add those files with `git add -f`.
