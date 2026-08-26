"""Union-frame join of estimates, WPP extract, geometry, and territory policy.

The countries array is NE 110m features we keep UNION WPP ISO-3 UNION matched
estimate rows. Unmatched estimates stay in a sibling list and never get a fake
ISO-3. Country means are never copied from neighbors or sovereigns.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Mapping

from hightail.geometry import GeometryFeature, GeometryIndex
from hightail.ingest import EstimateRecord, IngestResult, UnmatchedRow
from hightail.normalize import TerritoryPolicy, is_excluded_territory
from hightail.tails import DEFAULT_SIGMA, compute_tails
from hightail.wpp import WppRow

TINY_POPULATION_THRESHOLD = 250_000


class JoinError(ValueError):
    """Join failed (unmatched estimates, missing frame, etc.)."""


@dataclass(frozen=True)
class JoinResult:
    countries: tuple[dict[str, Any], ...]
    unmatched: tuple[UnmatchedRow, ...]
    n_geometry_dropped: int = 0

    @property
    def n_ok(self) -> int:
        return sum(1 for row in self.countries if row["status"] == "ok")

    @property
    def n_no_estimate(self) -> int:
        return sum(1 for row in self.countries if row["status"] == "no_estimate")

    @property
    def n_no_iso(self) -> int:
        return sum(1 for row in self.countries if row["status"] == "no_iso")

    @property
    def n_excluded_territory(self) -> int:
        return sum(1 for row in self.countries if row["status"] == "excluded_territory")

    @property
    def n_unmatched(self) -> int:
        return len(self.unmatched)


def _shorten_source(source: str | None) -> str | None:
    if source is None:
        return None
    stripped = source.strip()
    if not stripped:
        return None
    if stripped.upper().startswith("DEMO"):
        return "DEMO"
    token = stripped.split(",")[0].strip()
    return token if len(token) <= 32 else token[:32]


def _sigma_fields(
    record: EstimateRecord | None,
) -> tuple[float | None, str | None, str | None]:
    if record is None:
        return None, None, None
    if record.sigma is None:
        return DEFAULT_SIGMA, "assumed_15", None
    return record.sigma, "source", record.sigma_flag


def _empty_estimate_fields() -> dict[str, Any]:
    return {
        "mu": None,
        "sigma": None,
        "sigma_source": None,
        "sigma_flag": None,
        "mu_se": None,
        "p_hat": None,
        "p_lo_pm3": None,
        "p_hi_pm3": None,
        "p_lo_se": None,
        "p_hi_se": None,
        "estimated_n_ge_130": None,
        "quality": None,
        "source": None,
        "source_short": None,
        "source_url": None,
        "source_year": None,
        "sample_n": None,
        "sample_type": None,
        "notes": None,
    }


def _ok_fields(record: EstimateRecord, population: int | None) -> dict[str, Any]:
    sigma, sigma_source, sigma_flag = _sigma_fields(record)
    tails = compute_tails(record.mu, sigma, record.mu_se)
    estimated_n: int | None = None
    if tails["p_hat"] is not None and population is not None:
        estimated_n = int(round(tails["p_hat"] * population))
    return {
        "mu": record.mu,
        "sigma": sigma,
        "sigma_source": sigma_source,
        "sigma_flag": sigma_flag,
        "mu_se": record.mu_se,
        "p_hat": tails["p_hat"],
        "p_lo_pm3": tails["p_lo_pm3"],
        "p_hi_pm3": tails["p_hi_pm3"],
        "p_lo_se": tails["p_lo_se"],
        "p_hi_se": tails["p_hi_se"],
        "estimated_n_ge_130": estimated_n,
        "quality": record.quality,
        "source": record.source,
        "source_short": _shorten_source(record.source),
        "source_url": record.source_url,
        "source_year": record.source_year,
        "sample_n": record.sample_n,
        "sample_type": record.sample_type,
        "notes": record.notes,
    }


def _display_name(
    record: EstimateRecord | None,
    wpp: WppRow | None,
    iso3: str,
    geom: GeometryFeature | None = None,
) -> str:
    if record is not None and record.name:
        return record.name
    if geom is not None:
        if geom.name_en:
            return geom.name_en
        if geom.name:
            return geom.name
    if wpp is not None and wpp.name:
        return wpp.name
    return iso3


def _country_record(
    iso3: str,
    *,
    record: EstimateRecord | None,
    wpp: WppRow | None,
    policy: TerritoryPolicy,
    geom: GeometryFeature | None = None,
) -> dict[str, Any]:
    excluded = is_excluded_territory(iso3, policy)
    if excluded:
        status = "excluded_territory"
        fields = _empty_estimate_fields()
    elif record is not None:
        status = "ok"
        population = wpp.population if wpp is not None else None
        fields = _ok_fields(record, population)
    elif geom is not None and geom.no_iso:
        status = "no_iso"
        fields = _empty_estimate_fields()
    else:
        status = "no_estimate"
        fields = _empty_estimate_fields()

    has_geometry = geom is not None
    population = wpp.population if wpp is not None else None
    pop_year = wpp.pop_year if wpp is not None else None
    if has_geometry and geom is not None and geom.continent:
        continent = geom.continent
    elif wpp is not None:
        continent = wpp.continent
    else:
        continent = None
    if wpp is not None and wpp.region_m49:
        region_m49 = wpp.region_m49
    elif geom is not None:
        region_m49 = geom.region_un
    else:
        region_m49 = None
    tiny = population is not None and population < TINY_POPULATION_THRESHOLD

    return {
        "iso3": iso3,
        "name": _display_name(record, wpp, iso3, geom),
        "continent": continent,
        "region_m49": region_m49,
        **fields,
        "population": population,
        "pop_year": pop_year,
        "status": status,
        "has_geometry": has_geometry,
        "tiny_population": tiny,
    }


def unmatched_as_dicts(rows: tuple[UnmatchedRow, ...] | list[UnmatchedRow]) -> list[dict[str, Any]]:
    return [
        {
            "raw_name": row.raw_name,
            "raw_iso3": row.raw_iso3,
            "mu": row.mu,
            "reason": row.reason,
        }
        for row in rows
    ]


def join_frame(
    ingest: IngestResult,
    wpp: Mapping[str, WppRow],
    policy: TerritoryPolicy,
    *,
    allow_unmatched: bool = False,
    geometry: GeometryIndex | None = None,
    fail_on_geometry_dropped: bool = True,
) -> JoinResult:
    """Build the union frame. Never imputes μ from a different ISO-3."""
    if ingest.unmatched and not allow_unmatched:
        labels = [
            row.raw_name or row.raw_iso3 or "(anonymous)" for row in ingest.unmatched
        ]
        raise JoinError(
            "unmatched estimates (pass --allow-unmatched to emit them as a "
            f"sibling array): {', '.join(labels)}"
        )

    n_dropped = geometry.n_geometry_dropped if geometry is not None else 0
    if fail_on_geometry_dropped and n_dropped > 0:
        raise JoinError(f"n_geometry_dropped={n_dropped} > 0")

    estimates = {row.iso3: row for row in ingest.records}
    geom_features = dict(geometry.features) if geometry is not None else {}
    keys = set(wpp) | set(estimates) | set(geom_features)
    countries = [
        _country_record(
            iso3,
            record=estimates.get(iso3),
            wpp=wpp.get(iso3),
            policy=policy,
            geom=geom_features.get(iso3),
        )
        for iso3 in sorted(keys)
    ]
    return JoinResult(
        countries=tuple(countries),
        unmatched=ingest.unmatched,
        n_geometry_dropped=n_dropped,
    )
