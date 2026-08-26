"""Legal-review gate shared by post-v1 source adapters.

Adapters never download contested tables. They refuse to run unless
``HIGHTAIL_ADAPTER_LICENSE_OK=1`` (or ``license_ok=True``) **and** a
local path to an uncommitted source file is provided.
"""

from __future__ import annotations

import csv
import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping, Sequence

LICENSE_ENV = "HIGHTAIL_ADAPTER_LICENSE_OK"
LICENSE_OK_VALUE = "1"

DEFAULT_IQ_METRIC_LABEL = "Estimated share modeled at IQ ≥ 130"

ESTIMATE_COLUMNS: tuple[str, ...] = (
    "iso3",
    "name",
    "mu",
    "sigma",
    "mu_se",
    "source",
    "source_url",
    "source_year",
    "sample_n",
    "sample_type",
    "quality",
    "notes",
)

LEGAL_REVIEW_MESSAGE = (
    "This adapter is blocked pending legal review of contested national-IQ "
    "compilations (Lynn/Vanhanen, Becker NIQ, and similar tables) and of any "
    "PISA extract used as a μ proxy. Do not download or vendor those tables. "
    f"After license review, set {LICENSE_ENV}={LICENSE_OK_VALUE} and pass a "
    "local, uncommitted source file. Adapters never download source tables. "
    "See pipeline/src/hightail/adapters/README.md."
)

MISSING_PATH_MESSAGE = (
    "A local, uncommitted source file path is required. Adapters never "
    "download contested tables. Place the extract outside git (data/raw/ "
    "IQ/NIQ names are gitignored) and pass --source. See "
    "pipeline/src/hightail/adapters/README.md."
)

NO_DOWNLOAD_MESSAGE = (
    "Adapters never download contested tables. Pass a path to a local file, "
    "not a URL. See pipeline/src/hightail/adapters/README.md."
)


class AdapterError(ValueError):
    """Adapter refused to run or could not map the local source file."""


class AdapterLicenseError(AdapterError):
    """Missing legal-review gate, or no local source path."""


@dataclass(frozen=True)
class AdapterResult:
    rows: tuple[dict[str, Any], ...]
    metric_label: str
    dataset_id: str
    source_name: str
    citation: str
    n_imputed: int = 0


def _looks_remote(value: str) -> bool:
    lowered = value.strip().lower()
    return lowered.startswith(("http://", "https://", "ftp://", "ftps://"))


def require_adapter_license(
    source_path: Path | str | None,
    *,
    license_ok: bool | None = None,
    env: Mapping[str, str] | None = None,
) -> Path:
    """Return the local source path, or raise ``AdapterLicenseError``.

    Both an explicit license flag (env ``=1`` or ``license_ok=True``) and a
    real local file are required. Remote URLs are rejected so this package
    cannot be used as a downloader for contested tables.
    """
    environ: Mapping[str, str] = os.environ if env is None else env
    flagged = bool(license_ok) or environ.get(LICENSE_ENV) == LICENSE_OK_VALUE
    if not flagged:
        raise AdapterLicenseError(LEGAL_REVIEW_MESSAGE)

    if source_path is None or str(source_path).strip() == "":
        raise AdapterLicenseError(MISSING_PATH_MESSAGE)

    text = str(source_path).strip()
    if _looks_remote(text):
        raise AdapterLicenseError(NO_DOWNLOAD_MESSAGE)

    path = Path(text)
    if not path.is_file():
        raise AdapterLicenseError(
            f"local source file not found: {path}. "
            "Place an uncommitted extract on disk after legal review. "
            "Adapters never download contested tables. See "
            "pipeline/src/hightail/adapters/README.md."
        )
    return path


def normalize_key(key: str) -> str:
    return key.strip().lower().replace(" ", "_").replace("-", "_")


def normalize_row(row: Mapping[str, Any]) -> dict[str, str]:
    omitted: dict[str, str] = {}
    for key, value in row.items():
        if key is None or value is None:
            continue
        field = normalize_key(str(key))
        if not field:
            continue
        text = str(value).strip()
        if text == "":
            continue
        omitted[field] = text
    return omitted


def read_local_csv(path: Path) -> list[dict[str, str]]:
    """Read a UTF-8 CSV; empty/whitespace cells omitted. No network I/O."""
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise AdapterError(f"source CSV must have a header row: {path}")
        rows: list[dict[str, str]] = []
        for raw in reader:
            omitted: dict[str, str] = {}
            for key, value in raw.items():
                if key is None:
                    continue
                field = normalize_key(key)
                if not field or value is None:
                    continue
                text = value.strip()
                if text == "":
                    continue
                omitted[field] = text
            if omitted:
                rows.append(omitted)
        if not rows:
            raise AdapterError(f"source CSV has no data rows: {path}")
        return rows


def first_present(row: Mapping[str, str], keys: Sequence[str]) -> str | None:
    for key in keys:
        value = row.get(key)
        if value is not None and value.strip() != "":
            return value.strip()
    return None


def parse_float(value: str, field: str) -> float:
    try:
        number = float(value)
    except ValueError as exc:
        raise AdapterError(f"{field} must be a number, got {value!r}") from exc
    if not math.isfinite(number):
        raise AdapterError(f"{field} must be finite, got {value!r}")
    return number


def parse_optional_int(value: str | None, field: str) -> int | None:
    if value is None or value.strip() == "":
        return None
    number = parse_float(value, field)
    if abs(number - round(number)) > 1e-9:
        raise AdapterError(f"{field} must be an integer, got {value!r}")
    return int(round(number))


def write_estimates_csv(result: AdapterResult, path: Path | str) -> None:
    """Write adapter rows as an estimates-schema CSV. Caller must not commit it."""
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(ESTIMATE_COLUMNS), extrasaction="ignore")
        writer.writeheader()
        for row in result.rows:
            writer.writerow({key: "" if row.get(key) is None else row[key] for key in ESTIMATE_COLUMNS})
