"""PISA adapter (post-v1, legal-review gate).

OECD PISA is scholastic achievement, not IQ. This adapter relabels
``metric_label`` away from “IQ ≥ 130” and never calls PISA an intelligence
quotient. It does not download OECD files; a local extract plus the license
gate is required.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping, Sequence

from hightail.adapters.gate import (
    AdapterError,
    AdapterResult,
    first_present,
    normalize_row,
    parse_float,
    parse_optional_int,
    read_local_csv,
    require_adapter_license,
)
from hightail.tails import DEFAULT_SIGMA, THRESHOLD_IQ

# OECD PISA convention. +2 SD on this scale is 700, analogous in z-units
# to IQ 130 under σ=15, but it is not an IQ threshold.
PISA_OECD_MEAN = 500.0
PISA_OECD_SD = 100.0
PISA_THRESHOLD = 700.0

PISA_METRIC_LABEL = (
    "Estimated share of 15-year-olds modeled at PISA ≥ 700 (scholastic achievement)"
)
PISA_SOURCE = "OECD PISA local extract (scholastic achievement, not IQ)"
PISA_CITATION = (
    "OECD PISA. Scholastic achievement among sampled 15-year-olds; not IQ. "
    "Do not treat the affine-mapped location as an IQ estimate. "
    "See adapters/README.md."
)

_ISO_KEYS = ("iso3", "iso", "iso_code", "iso_a3")
_NAME_KEYS = ("name", "country", "country_name", "nation")
# Prefer explicit PISA columns. `mu` is last: a PISA extract may reuse it
# for the OECD-scale score, which is ~500, not an IQ mean.
_SCORE_KEYS = (
    "pisa",
    "pisa_mean",
    "math_mean",
    "reading_mean",
    "science_mean",
    "math",
    "reading",
    "science",
    "score",
    "mu",
)


def pisa_to_pipeline_mu(pisa_score: float) -> float:
    """Map a PISA score onto the pipeline (T=130, σ=15) location.

    Chosen so ``P(X ≥ 130 | μ, 15)`` equals ``P(PISA ≥ 700 | score, 100)``.
    The result is a location parameter for the existing tail formula, not
    an IQ estimate.
    """
    z = (PISA_THRESHOLD - pisa_score) / PISA_OECD_SD
    return THRESHOLD_IQ - DEFAULT_SIGMA * z


def transform_pisa_rows(rows: Sequence[Mapping[str, str]]) -> AdapterResult:
    """Map already-loaded PISA-like rows. Always sets a non-IQ metric_label."""
    mapped: list[dict[str, Any]] = []
    for raw in rows:
        row = normalize_row(raw)
        iso_raw = first_present(row, _ISO_KEYS)
        iso3 = iso_raw.upper() if iso_raw else None
        name = first_present(row, _NAME_KEYS)
        score_raw = first_present(row, _SCORE_KEYS)
        if score_raw is None:
            raise AdapterError("PISA row is missing a score column (pisa/math/score/mu)")
        if not iso3 and not name:
            raise AdapterError("PISA row needs iso3 or name")

        pisa_score = parse_float(score_raw, "pisa")
        mu = pisa_to_pipeline_mu(pisa_score)
        mapped.append(
            {
                "iso3": iso3,
                "name": name,
                "mu": mu,
                "sigma": DEFAULT_SIGMA,
                "mu_se": None,
                "source": PISA_SOURCE,
                "source_url": None,
                "source_year": parse_optional_int(
                    row.get("source_year") or row.get("year"), "source_year"
                ),
                "sample_n": parse_optional_int(row.get("sample_n") or row.get("n"), "sample_n"),
                "sample_type": "students",
                "quality": None,
                "notes": (
                    f"PISA mean {pisa_score:g} on the OECD scale "
                    f"(mean {PISA_OECD_MEAN:g}, SD {PISA_OECD_SD:g}). "
                    "Affine-mapped onto the pipeline tail formula so "
                    f"P(X≥{THRESHOLD_IQ:g}) equals P(PISA≥{PISA_THRESHOLD:g}). "
                    "Scholastic achievement, not IQ."
                ),
            }
        )

    return AdapterResult(
        rows=tuple(mapped),
        metric_label=PISA_METRIC_LABEL,
        dataset_id="pisa-local",
        source_name=PISA_SOURCE,
        citation=PISA_CITATION,
        n_imputed=0,
    )


def load_pisa(
    source_path: Path | str | None,
    *,
    license_ok: bool | None = None,
    env: Mapping[str, str] | None = None,
    rows: Sequence[Mapping[str, str]] | None = None,
) -> AdapterResult:
    """Load a local PISA extract after the license gate.

    ``rows`` is an optional already-parsed table (tests). A local path is
    still required so this cannot run as a downloader.
    """
    path = require_adapter_license(source_path, license_ok=license_ok, env=env)
    table = list(rows) if rows is not None else read_local_csv(path)
    return transform_pisa_rows(table)
