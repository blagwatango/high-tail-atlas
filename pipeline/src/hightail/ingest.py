"""CSV ingest and schema validation for estimate rows.

Empty/whitespace cells are omitted before validation (a Pandas/Papa empty
string is not a missing key). Missing country means are never filled from
neighbors or sovereigns; unmatched rows stay in a sibling list.
"""

from __future__ import annotations

import csv
import json
import math
import re
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, Literal, Mapping
from urllib.parse import urlparse

from jsonschema import Draft7Validator, FormatChecker
from jsonschema.exceptions import ValidationError

from hightail.normalize import (
    Iso3Overrides,
    TerritoryPolicy,
    UnmatchedReason,
    load_iso3_overrides,
    load_territory_policy,
    resolve_row,
)
from hightail.quality import QUALITIES, SAMPLE_TYPES, assign_quality
from hightail.scale import IQ_SCALE, ScaleConfig, get_scale

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_SCHEMA = _REPO_ROOT / "data" / "schemas" / "estimates.schema.json"

_ISO3_SCHEMA_RE = re.compile(r"^[A-Z]{3}$")

KNOWN_FIELDS = frozenset(
    {
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
    }
)

MU_MIN = 50.0
MU_MAX = 130.0
SIGMA_MIN = 5.0
SIGMA_MAX = 30.0
SIGMA_FLAG_LO = 12.0
SIGMA_FLAG_HI = 20.0
SOURCE_YEAR_MIN = 1900
SOURCE_YEAR_MAX = 2026

OnDuplicate = Literal["error", "first", "mean"]
ON_DUPLICATE_CHOICES: tuple[OnDuplicate, ...] = ("error", "first", "mean")


class IngestError(ValueError):
    """Invalid estimates file or row."""


@dataclass(frozen=True)
class EstimateRecord:
    iso3: str
    mu: float
    name: str | None = None
    sigma: float | None = None
    mu_se: float | None = None
    source: str | None = None
    source_url: str | None = None
    source_year: int | None = None
    sample_n: int | None = None
    sample_type: str | None = None
    quality: str | None = None
    notes: str | None = None
    sigma_flag: str | None = None
    source_extra: Mapping[str, str] = field(default_factory=dict)
    extreme_mu: bool = False


@dataclass(frozen=True)
class UnmatchedRow:
    raw_name: str | None
    raw_iso3: str | None
    mu: float
    reason: str


@dataclass(frozen=True)
class IngestResult:
    records: tuple[EstimateRecord, ...]
    unmatched: tuple[UnmatchedRow, ...]
    n_read: int

    @property
    def n_ok(self) -> int:
        return len(self.records)

    @property
    def n_unmatched(self) -> int:
        return len(self.unmatched)


def _is_absolute_uri(value: object) -> bool:
    """JSON Schema format:uri — absolute URI. Bare jsonschema has no uri checker."""
    if not isinstance(value, str):
        return True
    parsed = urlparse(value)
    if not parsed.scheme:
        return False
    if parsed.scheme.lower() in {"http", "https"}:
        return bool(parsed.netloc)
    return bool(parsed.netloc or parsed.path)


def _load_row_validator(schema_path: Path) -> Draft7Validator:
    root = json.loads(schema_path.read_text(encoding="utf-8"))
    if not isinstance(root, dict) or "definitions" not in root:
        raise IngestError(f"estimates schema missing definitions: {schema_path}")
    row_schema = {
        "$schema": root.get("$schema", "http://json-schema.org/draft-07/schema#"),
        "definitions": root["definitions"],
        **root["definitions"]["EstimateRow"],
    }
    checker = FormatChecker()
    checker.checks("uri")(_is_absolute_uri)
    return Draft7Validator(row_schema, format_checker=checker)


def _omit_empty_cells(raw: Mapping[str | None, str | None]) -> dict[str, str]:
    omitted: dict[str, str] = {}
    for key, value in raw.items():
        if key is None:
            continue
        field_name = key.strip()
        if not field_name:
            continue
        if value is None:
            continue
        text = value.strip()
        if text == "":
            continue
        omitted[field_name] = text
    return omitted


def _read_csv_rows(path: Path) -> list[tuple[int, dict[str, str]]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise IngestError("CSV must have a header row")
        names = [(name.strip() if name else "") for name in reader.fieldnames]
        if any(name == "" for name in names):
            raise IngestError("CSV header contains an empty column name")
        if len(names) != len(set(names)):
            raise IngestError("CSV header contains duplicate column names")
        reader.fieldnames = names
        rows: list[tuple[int, dict[str, str]]] = []
        for line_no, raw in enumerate(reader, start=2):
            omitted = _omit_empty_cells(raw)
            if omitted:
                rows.append((line_no, omitted))
        return rows


def _parse_float(value: str, field: str, line_no: int) -> float:
    try:
        number = float(value)
    except ValueError as exc:
        raise IngestError(f"row {line_no}: {field} must be a number, got {value!r}") from exc
    if not math.isfinite(number):
        raise IngestError(f"row {line_no}: {field} must be finite, got {value!r}")
    return number


def _parse_int(value: str, field: str, line_no: int) -> int:
    number = _parse_float(value, field, line_no)
    if abs(number - round(number)) > 1e-9:
        raise IngestError(f"row {line_no}: {field} must be an integer, got {value!r}")
    return int(round(number))


def _sigma_flag(sigma: float | None, scale: ScaleConfig = IQ_SCALE) -> str | None:
    if sigma is None:
        return None
    if sigma < scale.sigma_flag_lo or sigma > scale.sigma_flag_hi:
        return scale.sigma_flag_label
    return None


def _typed_fields(omitted: Mapping[str, str], line_no: int) -> dict[str, Any]:
    if "mu" not in omitted:
        raise IngestError(f"row {line_no}: mu is required")
    iso3 = omitted.get("iso3")
    name = omitted.get("name")
    if iso3 is not None:
        iso3 = iso3.upper()
    if not iso3 and not name:
        raise IngestError(f"row {line_no}: iso3 or name required")

    typed: dict[str, Any] = {"mu": _parse_float(omitted["mu"], "mu", line_no)}
    if iso3:
        typed["iso3"] = iso3
    if name:
        typed["name"] = name
    if "sigma" in omitted:
        typed["sigma"] = _parse_float(omitted["sigma"], "sigma", line_no)
    if "mu_se" in omitted:
        typed["mu_se"] = _parse_float(omitted["mu_se"], "mu_se", line_no)
    if "source" in omitted:
        typed["source"] = omitted["source"]
    if "source_url" in omitted:
        typed["source_url"] = omitted["source_url"]
    if "source_year" in omitted:
        typed["source_year"] = _parse_int(omitted["source_year"], "source_year", line_no)
    if "sample_n" in omitted:
        typed["sample_n"] = _parse_int(omitted["sample_n"], "sample_n", line_no)
    if "sample_type" in omitted:
        typed["sample_type"] = omitted["sample_type"]
    if "quality" in omitted:
        typed["quality"] = omitted["quality"]
    if "notes" in omitted:
        typed["notes"] = omitted["notes"]
    return typed


def _validate_typed(
    typed: Mapping[str, Any],
    line_no: int,
    *,
    allow_extreme_mu: bool,
    scale: ScaleConfig = IQ_SCALE,
) -> bool:
    """Return True when mu is outside the scale range and the extreme-mu flag is set."""
    mu = typed["mu"]
    extreme = not (scale.mu_min < mu < scale.mu_max)
    if extreme and not allow_extreme_mu:
        raise IngestError(
            f"row {line_no}: mu must be in ({scale.mu_min:g}, {scale.mu_max:g}), got {mu}; "
            "pass --allow-extreme-mu to keep the row as quality E"
        )

    sigma = typed.get("sigma")
    if sigma is not None and not (scale.sigma_min < sigma < scale.sigma_max):
        raise IngestError(
            f"row {line_no}: sigma must be in ({scale.sigma_min:g}, {scale.sigma_max:g}), got {sigma}"
        )

    mu_se = typed.get("mu_se")
    if mu_se is not None and mu_se < 0:
        raise IngestError(f"row {line_no}: mu_se must be >= 0, got {mu_se}")

    sample_type = typed.get("sample_type")
    if sample_type is not None and sample_type not in SAMPLE_TYPES:
        raise IngestError(f"row {line_no}: invalid sample_type: {sample_type!r}")

    quality = typed.get("quality")
    if quality is not None and quality not in QUALITIES:
        raise IngestError(f"row {line_no}: invalid quality: {quality!r}")

    source_year = typed.get("source_year")
    if source_year is not None and not (SOURCE_YEAR_MIN <= source_year <= SOURCE_YEAR_MAX):
        raise IngestError(
            f"row {line_no}: source_year must be in [{SOURCE_YEAR_MIN}, {SOURCE_YEAR_MAX}], "
            f"got {source_year}"
        )

    sample_n = typed.get("sample_n")
    if sample_n is not None and sample_n < 1:
        raise IngestError(f"row {line_no}: sample_n must be a positive integer, got {sample_n}")

    source_url = typed.get("source_url")
    if source_url is not None and not _is_absolute_uri(source_url):
        raise IngestError(f"row {line_no}: source_url must be a URI, got {source_url!r}")

    return extreme


def _schema_instance(typed: Mapping[str, Any], *, extreme_mu: bool) -> dict[str, Any]:
    instance = dict(typed)
    if extreme_mu:
        instance["mu"] = 100.0
    iso3 = instance.get("iso3")
    if isinstance(iso3, str) and not _ISO3_SCHEMA_RE.fullmatch(iso3):
        instance.pop("iso3", None)
        # ISO-2 / ADM0 tokens are resolved later. Keep anyOf(iso3|name) so
        # remaining properties (source_url, enums, ranges) still validate.
        if not instance.get("name"):
            instance["iso3"] = "XXX"
    return instance


def _collapse_duplicates(
    records: list[EstimateRecord],
    on_duplicate: OnDuplicate,
) -> list[EstimateRecord]:
    grouped: dict[str, list[EstimateRecord]] = {}
    order: list[str] = []
    for record in records:
        if record.iso3 not in grouped:
            order.append(record.iso3)
            grouped[record.iso3] = []
        grouped[record.iso3].append(record)

    duplicates = [iso3 for iso3 in order if len(grouped[iso3]) > 1]
    if not duplicates:
        return records
    if on_duplicate == "error":
        raise IngestError(f"duplicate ISO-3: {', '.join(duplicates)}")

    collapsed: list[EstimateRecord] = []
    for iso3 in order:
        group = grouped[iso3]
        if len(group) == 1 or on_duplicate == "first":
            collapsed.append(group[0])
            continue
        mu = sum(item.mu for item in group) / len(group)
        sigmas = [item.sigma for item in group]
        sigma = (
            sum(value for value in sigmas if value is not None) / len(sigmas)
            if all(value is not None for value in sigmas)
            else group[0].sigma
        )
        extreme = not (MU_MIN < mu < MU_MAX)
        collapsed.append(
            replace(
                group[0],
                mu=mu,
                sigma=sigma,
                quality="E" if extreme else group[0].quality,
                sigma_flag=_sigma_flag(sigma),
                extreme_mu=extreme,
            )
        )
    return collapsed


def ingest_estimates(
    path: Path | str,
    *,
    overrides: Iso3Overrides | None = None,
    policy: TerritoryPolicy | None = None,
    allow_extreme_mu: bool = False,
    on_duplicate: OnDuplicate = "error",
    schema_path: Path | str | None = None,
    scale: ScaleConfig | str | None = None,
) -> IngestResult:
    """Read a UTF-8 estimates CSV, validate, and normalize ISO-3 keys."""
    loaded_scale = get_scale(scale)
    csv_path = Path(path)
    if not csv_path.is_file():
        raise IngestError(f"estimates file not found: {csv_path}")
    if on_duplicate not in ON_DUPLICATE_CHOICES:
        raise IngestError(f"on_duplicate must be one of {ON_DUPLICATE_CHOICES}")

    loaded_overrides = overrides if overrides is not None else load_iso3_overrides()
    loaded_policy = policy if policy is not None else load_territory_policy()
    validator = _load_row_validator(
        Path(schema_path) if schema_path is not None else _DEFAULT_SCHEMA
    )

    records: list[EstimateRecord] = []
    unmatched: list[UnmatchedRow] = []
    rows = _read_csv_rows(csv_path)

    for line_no, omitted in rows:
        typed = _typed_fields(omitted, line_no)
        extra = {
            key: value for key, value in omitted.items() if key not in KNOWN_FIELDS
        }
        extreme = _validate_typed(
            typed, line_no, allow_extreme_mu=allow_extreme_mu, scale=loaded_scale
        )

        instance = _schema_instance(typed, extreme_mu=extreme)
        try:
            validator.validate(instance)
        except ValidationError as exc:
            raise IngestError(f"row {line_no}: {exc.message}") from exc

        resolved = resolve_row(
            iso3=typed.get("iso3"),
            name=typed.get("name"),
            overrides=loaded_overrides,
            policy=loaded_policy,
        )
        if not resolved.matched:
            reason = resolved.reason or UnmatchedReason.UNMAPPED_NAME
            unmatched.append(
                UnmatchedRow(
                    raw_name=typed.get("name"),
                    raw_iso3=typed.get("iso3"),
                    mu=typed["mu"],
                    reason=str(reason),
                )
            )
            continue

        quality = assign_quality(
            source_quality=typed.get("quality"),
            sample_type=typed.get("sample_type"),
            sample_n=typed.get("sample_n"),
            source_year=typed.get("source_year"),
            source=typed.get("source"),
        )
        if extreme:
            quality = "E"

        iso3 = resolved.iso3
        assert iso3 is not None
        records.append(
            EstimateRecord(
                iso3=iso3,
                name=typed.get("name"),
                mu=typed["mu"],
                sigma=typed.get("sigma"),
                mu_se=typed.get("mu_se"),
                source=typed.get("source"),
                source_url=typed.get("source_url"),
                source_year=typed.get("source_year"),
                sample_n=typed.get("sample_n"),
                sample_type=typed.get("sample_type"),
                quality=quality,
                notes=typed.get("notes"),
                sigma_flag=_sigma_flag(typed.get("sigma"), loaded_scale),
                source_extra=extra,
                extreme_mu=extreme,
            )
        )

    return IngestResult(
        records=tuple(_collapse_duplicates(records, on_duplicate)),
        unmatched=tuple(unmatched),
        n_read=len(rows),
    )
