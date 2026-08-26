"""Becker NIQ adapter (post-v1, legal-review gate).

Not v1 default data. Never downloads or vendors the raw table.
Neighbor-imputed rows are forced to quality D / sample_type=imputed so
default filters will drop them if this adapter is ever unblocked.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Mapping, Sequence

from hightail.adapters.gate import (
    DEFAULT_IQ_METRIC_LABEL,
    AdapterError,
    AdapterResult,
    first_present,
    normalize_row,
    parse_float,
    parse_optional_int,
    read_local_csv,
    require_adapter_license,
)

_ISO_KEYS = ("iso3", "iso", "iso_code", "iso_a3")
_NAME_KEYS = ("name", "country", "country_name", "nation")
_MEAN_KEYS = ("mu", "iq", "niq", "national_iq", "score", "mean")
_IMPUTED_FLAG_KEYS = (
    "imputed",
    "neighbor_imputed",
    "estimated_from_neighbors",
    "is_imputed",
    "geographic_imputation",
)
_IMPUTED_TEXT_KEYS = ("method", "estimation", "notes", "quality_notes", "source", "sample_type")
_TRUE = frozenset(
    {
        "1",
        "true",
        "yes",
        "y",
        "t",
        "imputed",
        "neighbor",
        "neighbors",
        "neighbor_imputed",
        "estimated",
    }
)
_IMPUTED_TOKENS = ("neighbor", "imputed", "geograph")

BECKER_SOURCE = "Becker NIQ (local extract; contested; not v1 default)"
BECKER_CITATION = (
    "Becker NIQ updates follow the Lynn & Vanhanen lineage and are "
    "scientifically contested (Sear 2022; Wicherts et al. 2010; EHBEA 2020). "
    "Neighbor-imputed rows are quality D / sample_type=imputed. This adapter "
    "does not endorse the table and does not vendor it."
)


def _is_imputed(row: Mapping[str, str]) -> bool:
    sample_type = row.get("sample_type", "").strip().lower()
    if sample_type == "imputed":
        return True
    if row.get("quality", "").strip().upper() == "D":
        return True
    for key in _IMPUTED_FLAG_KEYS:
        raw = row.get(key)
        if raw is not None and raw.strip().lower() in _TRUE:
            return True
    # "estimated" is only a flag when it is a yes/no-style cell, not a mean.
    estimated = row.get("estimated")
    if estimated is not None and estimated.strip().lower() in _TRUE:
        return True
    blob = " ".join(row.get(key, "") for key in _IMPUTED_TEXT_KEYS).lower()
    return any(token in blob for token in _IMPUTED_TOKENS)


def _row_identity(row: Mapping[str, str]) -> tuple[str | None, str | None]:
    iso3_raw = first_present(row, _ISO_KEYS)
    iso3 = iso3_raw.upper() if iso3_raw else None
    name = first_present(row, _NAME_KEYS)
    return iso3, name


def transform_becker_rows(rows: Sequence[Mapping[str, str]]) -> AdapterResult:
    """Map already-loaded rows. Neighbor-imputed → quality D / imputed."""
    mapped: list[dict[str, Any]] = []
    n_imputed = 0
    for raw in rows:
        row = normalize_row(raw)
        iso3, name = _row_identity(row)
        mean_raw = first_present(row, _MEAN_KEYS)
        if mean_raw is None:
            raise AdapterError("Becker row is missing a mean column (mu/iq/niq/score)")
        if not iso3 and not name:
            raise AdapterError("Becker row needs iso3 or name")

        mu = parse_float(mean_raw, "mu")
        imputed = _is_imputed(row)
        notes = row.get("notes")
        if imputed:
            prefix = notes.strip() + " " if notes else ""
            notes = prefix + "Neighbor-imputed or undocumented; quality D."
            n_imputed += 1
        record: dict[str, Any] = {
            "iso3": iso3,
            "name": name,
            "mu": mu,
            "sigma": parse_float(row["sigma"], "sigma") if "sigma" in row else None,
            "mu_se": None,
            "source": BECKER_SOURCE,
            "source_url": None,
            "source_year": parse_optional_int(row.get("source_year") or row.get("year"), "source_year"),
            "sample_n": parse_optional_int(row.get("sample_n") or row.get("n"), "sample_n"),
            "sample_type": "imputed" if imputed else (row.get("sample_type") or None),
            "quality": "D" if imputed else (row.get("quality") or None),
            "notes": notes,
        }
        mapped.append(record)

    return AdapterResult(
        rows=tuple(mapped),
        metric_label=DEFAULT_IQ_METRIC_LABEL,
        dataset_id="becker-local",
        source_name=BECKER_SOURCE,
        citation=BECKER_CITATION,
        n_imputed=n_imputed,
    )


def load_becker(
    source_path: Path | str | None,
    *,
    license_ok: bool | None = None,
    env: Mapping[str, str] | None = None,
    rows: Sequence[Mapping[str, str]] | None = None,
) -> AdapterResult:
    """Load a local Becker-style table after the license gate.

    ``rows`` is an optional already-parsed table (tests). A local path is
    still required so this cannot run as a downloader.
    """
    path = require_adapter_license(source_path, license_ok=license_ok, env=env)
    table = list(rows) if rows is not None else read_local_csv(path)
    return transform_becker_rows(table)
