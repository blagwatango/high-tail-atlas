"""Emit AtlasFile JSON (manifest + countries + unmatched_estimates)."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from importlib.metadata import PackageNotFoundError, version
from pathlib import Path
from statistics import median
from typing import Any, Mapping

from jsonschema import Draft7Validator, FormatChecker

from hightail.geometry import (
    DEFAULT_GEOMETRY_PATH,
    GeometryError,
    assert_has_geometry_in_topo,
    load_geometry,
)
from hightail.ingest import EstimateRecord, IngestResult, ingest_estimates
from hightail.join import JoinError, JoinResult, join_frame, unmatched_as_dicts
from hightail.normalize import load_iso3_overrides, load_territory_policy
from hightail.quality import QUALITIES
from hightail.scale import IQ_SCALE, ScaleConfig, get_scale
from hightail.wpp import DEFAULT_REFERENCE_YEAR, load_wpp_extract

_REPO_ROOT = Path(__file__).resolve().parents[3]
_ATLAS_SCHEMA = _REPO_ROOT / "data" / "schemas" / "atlas.schema.json"

FORMULA = "p = 1 - Phi((130 - mu) / sigma)"
PHI_IMPLEMENTATION = "scipy.stats.norm.sf"
METRIC_LABEL = "Estimated share modeled at IQ ≥ 130"
POPULATION_SOURCE = (
    "United Nations, DESA/Population Division (2024). "
    "World Population Prospects 2024. Medium variant, mid-year 2025."
)
GEOMETRY_SOURCE_NONE = "none"
DEMO_DATASET_ID = "demo-quality-c"
DEMO_SOURCE_NAME = "DEMO_FIXTURE"

# Must appear on /methodology and in atlas.json manifest.assumptions.
ASSUMPTIONS: tuple[str, ...] = (
    "IQ in each country is i.i.d. N(mu_i, sigma_i^2). Real distributions are discrete, bounded, and often skewed; the far tail is the part of a normal that is least credible.",
    "Tests, if any, are interval-scaled on the same metric as IQ points.",
    "mu_i is an unbiased estimate of the current national resident mean. Most sources fail this (children, convenience, old tests, Flynn drift, urban samples).",
    "sigma_i = 15 unless published. Between-country variance of SDs is ignored. If true sigma_i > 15, p_hat is understated for mu_i < 130; if sigma_i < 15, overstated.",
    "Independence from age structure. Applying p_hat to total population (including infants) is a modeling convenience, not a claim that toddlers have IQ scores. v1 does not age-standardize.",
    "No correction for restriction of range, test ceiling, or Flynn effect inside this pipeline. If the source already adjusted, that belongs in provenance, not a second adjustment.",
)

CAVEAT_TEXT = (
    "These figures are modeled estimates, not measurements. "
    "Each percentage is the right tail of a normal distribution given a "
    "published or assumed country mean and SD (default 15), applied to UN "
    "population counts. National IQ compilations are incomplete and contested. "
    "This is not a ranking of people, nations, or worth."
)

COVERAGE_ISO3 = ("USA", "CHN", "IND", "IDN", "PAK", "NGA", "BRA")


class EmitError(ValueError):
    """atlas.json failed validation or a build invariant."""


def pipeline_version() -> str:
    try:
        return version("hightail")
    except PackageNotFoundError:
        return "0.0.0"


def rfc3339_utc(now: datetime | None = None) -> str:
    dt = (now or datetime.now(timezone.utc)).astimezone(timezone.utc)
    dt = dt.replace(microsecond=0)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def caveats_hash(text: str = CAVEAT_TEXT) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _dataset_id(
    records: tuple[EstimateRecord, ...], scale: ScaleConfig = IQ_SCALE
) -> str:
    if scale.name == "pisa":
        return scale.dataset_id
    sources = {row.source for row in records if row.source}
    if not records or sources == {DEMO_SOURCE_NAME}:
        return DEMO_DATASET_ID
    return "user-csv"


def _estimates_source(
    records: tuple[EstimateRecord, ...], scale: ScaleConfig = IQ_SCALE
) -> dict[str, str | None]:
    sources = [row.source for row in records if row.source]
    if sources and all(name == sources[0] for name in sources):
        name = sources[0]
    elif sources:
        name = "user-csv"
    else:
        name = DEMO_SOURCE_NAME
    citation = None
    url = None
    if scale.name == "pisa":
        citation = (
            "OECD (2023). PISA 2022 Results (Volume I): The State of Learning "
            "and Equity in Education. Table I.B1.2.1 mathematics mean scores."
        )
        url = "https://doi.org/10.1787/53f23881-en"
        urls = {row.source_url for row in records if row.source_url}
        if len(urls) == 1:
            url = next(iter(urls))
    return {"name": name, "citation": citation, "url": url, "license": None}


def _n_quality(countries: tuple[dict[str, Any], ...]) -> dict[str, int]:
    counts = {code: 0 for code in ("A", "B", "C", "D", "E", "U")}
    for row in countries:
        quality = row.get("quality")
        if quality in counts:
            counts[quality] += 1
    return counts


def _validate_invariants(atlas: Mapping[str, Any]) -> None:
    countries = atlas["countries"]
    p_hats = [row["p_hat"] for row in countries if row["p_hat"] is not None]
    for value in p_hats:
        if not 0.0 <= value <= 1.0:
            raise EmitError(f"p_hat out of [0, 1]: {value}")
    if p_hats and median(p_hats) > 0.25:
        raise EmitError("median p_hat > 0.25 (likely mu/sigma units error)")
    by_iso = {row["iso3"]: row for row in countries}
    for iso3 in COVERAGE_ISO3:
        row = by_iso.get(iso3)
        if row is None:
            continue
        if row["status"] not in {"ok", "no_estimate"}:
            raise EmitError(f"coverage ISO-3 {iso3} has unexpected status {row['status']}")
    for row in countries:
        if row["quality"] is None and row["status"] == "ok":
            raise EmitError(f"{row['iso3']}: quality null on status ok")
        if row["quality"] is not None and row["status"] != "ok":
            raise EmitError(f"{row['iso3']}: quality set on status {row['status']}")
        if row["p_hat"] is None and row["status"] == "ok":
            raise EmitError(f"{row['iso3']}: p_hat null on status ok")
        if row["p_hat"] is not None and row["status"] != "ok":
            raise EmitError(f"{row['iso3']}: p_hat set on status {row['status']}")
        if (row["mu_se"] is None) != (row["p_lo_se"] is None):
            raise EmitError(f"{row['iso3']}: p_lo_se must be null iff mu_se is null")
        if row["quality"] is not None and row["quality"] not in QUALITIES:
            raise EmitError(f"{row['iso3']}: invalid quality {row['quality']!r}")


def build_manifest(
    join: JoinResult,
    records: tuple[EstimateRecord, ...],
    *,
    created_at: str | None = None,
    geometry_source: str | None = None,
    scale: ScaleConfig = IQ_SCALE,
) -> dict[str, Any]:
    dataset_id = _dataset_id(records, scale)
    threshold = int(scale.threshold) if scale.threshold == int(scale.threshold) else scale.threshold
    default_sigma = (
        int(scale.default_sigma)
        if scale.default_sigma == int(scale.default_sigma)
        else scale.default_sigma
    )
    return {
        "schema_version": 1,
        "dataset_id": dataset_id,
        "created_at": created_at or rfc3339_utc(),
        "pipeline_version": pipeline_version(),
        "threshold_iq": threshold,
        "default_sigma": default_sigma,
        "formula": scale.formula,
        "phi_implementation": PHI_IMPLEMENTATION,
        "metric_label": scale.metric_label,
        "population_source": POPULATION_SOURCE,
        "geometry_source": geometry_source if geometry_source is not None else GEOMETRY_SOURCE_NONE,
        "estimates_source": _estimates_source(records, scale),
        "caveats_hash": caveats_hash(scale.caveat_text),
        "n_ok": join.n_ok,
        "n_no_estimate": join.n_no_estimate,
        "n_no_iso": join.n_no_iso,
        "n_excluded_territory": join.n_excluded_territory,
        "n_unmatched": join.n_unmatched,
        "n_quality": _n_quality(join.countries),
        "flags": {
            "show_continuous_scale": False,
            "allow_quality_d": False,
            "demo_badge": dataset_id.startswith("demo-"),
        },
        "assumptions": list(scale.assumptions),
    }


def assemble_atlas(
    join: JoinResult,
    records: tuple[EstimateRecord, ...],
    *,
    created_at: str | None = None,
    geometry_source: str | None = None,
    scale: ScaleConfig = IQ_SCALE,
) -> dict[str, Any]:
    atlas = {
        "manifest": build_manifest(
            join,
            records,
            created_at=created_at,
            geometry_source=geometry_source,
            scale=scale,
        ),
        "countries": list(join.countries),
        "unmatched_estimates": unmatched_as_dicts(join.unmatched),
    }
    _validate_invariants(atlas)
    return atlas


def validate_atlas(
    atlas: Mapping[str, Any],
    schema_path: Path | str | None = None,
) -> None:
    path = Path(schema_path) if schema_path is not None else _ATLAS_SCHEMA
    schema = json.loads(path.read_text(encoding="utf-8"))
    Draft7Validator(schema, format_checker=FormatChecker()).validate(atlas)


def write_atlas(
    atlas: Mapping[str, Any],
    path: Path | str,
    *,
    schema_path: Path | str | None = None,
) -> None:
    validate_atlas(atlas, schema_path=schema_path)
    out = Path(path)
    if "src" in out.parts and "public" in out.parts:
        src_idx = out.parts.index("src")
        if src_idx + 1 < len(out.parts) and out.parts[src_idx + 1] == "public":
            raise EmitError(
                "refusing to write web/src/public (not served). "
                "Use web/public/data/atlas.json"
            )
    out.parent.mkdir(parents=True, exist_ok=True)
    with out.open("w", encoding="utf-8", newline="\n") as handle:
        json.dump(atlas, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def build_atlas(
    estimates_path: Path | str,
    population_path: Path | str,
    out_path: Path | str,
    *,
    overrides_path: Path | str | None = None,
    policy_path: Path | str | None = None,
    estimates_schema: Path | str | None = None,
    atlas_schema: Path | str | None = None,
    reference_year: int = DEFAULT_REFERENCE_YEAR,
    allow_unmatched: bool = False,
    allow_extreme_mu: bool = False,
    on_duplicate: str = "error",
    created_at: str | None = None,
    geometry_path: Path | str | None = None,
    scale: ScaleConfig | str | None = None,
) -> dict[str, Any]:
    loaded_scale = get_scale(scale)
    overrides = load_iso3_overrides(overrides_path)
    policy = load_territory_policy(policy_path)
    ingest: IngestResult = ingest_estimates(
        estimates_path,
        overrides=overrides,
        policy=policy,
        allow_extreme_mu=allow_extreme_mu,
        on_duplicate=on_duplicate,  # type: ignore[arg-type]
        schema_path=estimates_schema,
        scale=loaded_scale,
    )
    wpp = load_wpp_extract(population_path, reference_year=reference_year)
    geom_path = DEFAULT_GEOMETRY_PATH if geometry_path is None else Path(geometry_path)
    try:
        geometry = load_geometry(geom_path, policy=policy, overrides=overrides)
        if geometry.n_geometry_dropped > 0:
            raise EmitError(
                f"n_geometry_dropped={geometry.n_geometry_dropped} > 0"
            )
        joined = join_frame(
            ingest,
            wpp,
            policy,
            allow_unmatched=allow_unmatched,
            geometry=geometry,
            scale=loaded_scale,
        )
        assert_has_geometry_in_topo(joined.countries, geometry)
    except (JoinError, GeometryError) as exc:
        raise EmitError(str(exc)) from exc
    atlas = assemble_atlas(
        joined,
        ingest.records,
        created_at=created_at,
        geometry_source=geometry.source,
        scale=loaded_scale,
    )
    write_atlas(atlas, out_path, schema_path=atlas_schema)
    return atlas
