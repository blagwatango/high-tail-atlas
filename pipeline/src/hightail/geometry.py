"""Natural Earth 110m TopoJSON geometry index.

Public-domain source: Natural Earth Admin 0 Countries 1:110m v5.1.1.
ISO_A3 -99/null/empty uses ADM0_A3 when it is three alphanumeric characters.
Antarctica is omitted from the choropleth set, not counted as a drop.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Mapping

from hightail.normalize import Iso3Overrides, TerritoryPolicy, is_omitted_from_choropleth

_REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_GEOMETRY_PATH = _REPO_ROOT / "web" / "public" / "data" / "world-110m.topo.json"

GEOMETRY_SOURCE = (
    "Natural Earth Admin 0 Countries 1:110m (v5.1.1), public domain"
)

_ADM0_RE = re.compile(r"^[A-Z0-9]{3}$")
_MISSING_ISO = frozenset({"-99", "-099", "99", ""})


class GeometryError(ValueError):
    """TopoJSON geometry index failed."""


@dataclass(frozen=True)
class GeometryFeature:
    iso3: str
    iso_a3: str | None
    adm0_a3: str | None
    name: str | None
    name_en: str | None
    continent: str | None
    region_un: str | None
    no_iso: bool


@dataclass(frozen=True)
class GeometryIndex:
    features: Mapping[str, GeometryFeature]
    n_geometry_dropped: int
    topo_codes: frozenset[str]
    source: str = GEOMETRY_SOURCE

    def get(self, iso3: str) -> GeometryFeature | None:
        return self.features.get(iso3)

    def __contains__(self, iso3: str) -> bool:
        return iso3 in self.features


def _prop_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.casefold() in {"none", "null", "nan"}:
        return None
    return text


def _code(value: object) -> str | None:
    text = _prop_text(value)
    if text is None:
        return None
    return text.upper()


def _iso_a3_usable(iso_a3: str | None) -> bool:
    if iso_a3 is None or iso_a3 in _MISSING_ISO:
        return False
    return _ADM0_RE.fullmatch(iso_a3) is not None


def resolve_geometry_iso3(
    iso_a3: object,
    adm0_a3: object,
) -> tuple[str | None, bool, bool]:
    """Return (iso3, no_iso, dropped) from NE ISO_A3 / ADM0_A3.

    no_iso is True when ISO_A3 was missing/invalid and ADM0_A3 was used.
    dropped is True when the feature must be omitted from countries.
    """
    iso = _code(iso_a3)
    adm0 = _code(adm0_a3)
    if _iso_a3_usable(iso):
        return iso, False, False
    if adm0 is not None and _ADM0_RE.fullmatch(adm0):
        return adm0, True, False
    return None, False, True


def _alias_iso3(iso3: str, overrides: Iso3Overrides | None) -> str:
    if overrides is None:
        return iso3
    return (
        overrides.aliases.get(iso3)
        or overrides.aliases.get(iso3.upper())
        or iso3
    )


def _geometry_collection(topo: Mapping[str, Any]) -> list[dict[str, Any]]:
    if topo.get("type") != "Topology":
        raise GeometryError("geometry file is not a TopoJSON Topology")
    objects = topo.get("objects")
    if not isinstance(objects, dict) or not objects:
        raise GeometryError("TopoJSON has no objects")
    if "countries" in objects:
        collection = objects["countries"]
    elif len(objects) == 1:
        collection = next(iter(objects.values()))
    else:
        raise GeometryError("TopoJSON must have a 'countries' object")
    geometries = collection.get("geometries") if isinstance(collection, dict) else None
    if not isinstance(geometries, list):
        raise GeometryError("TopoJSON countries object has no geometries")
    return geometries


def load_geometry(
    path: Path | str | None = None,
    *,
    policy: TerritoryPolicy,
    overrides: Iso3Overrides | None = None,
) -> GeometryIndex:
    """Load NE TopoJSON properties and apply the ISO_A3=-99 join rule."""
    geom_path = Path(path) if path is not None else DEFAULT_GEOMETRY_PATH
    try:
        topo = json.loads(geom_path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise GeometryError(f"geometry TopoJSON not found: {geom_path}") from exc
    except json.JSONDecodeError as exc:
        raise GeometryError(f"geometry TopoJSON is not valid JSON: {geom_path}") from exc
    if not isinstance(topo, dict):
        raise GeometryError("geometry TopoJSON root must be an object")

    dropped = 0
    features: dict[str, GeometryFeature] = {}
    topo_codes: set[str] = set()

    for geom in _geometry_collection(topo):
        if not isinstance(geom, dict):
            dropped += 1
            continue
        props = geom.get("properties") or {}
        if not isinstance(props, dict):
            dropped += 1
            continue
        iso_a3 = _code(props.get("ISO_A3"))
        adm0_a3 = _code(props.get("ADM0_A3"))
        raw_iso3, no_iso, is_dropped = resolve_geometry_iso3(iso_a3, adm0_a3)
        if is_dropped or raw_iso3 is None:
            dropped += 1
            continue
        iso3 = _alias_iso3(raw_iso3, overrides)
        if iso_a3 is not None and _ADM0_RE.fullmatch(iso_a3):
            topo_codes.add(iso_a3)
        if adm0_a3 is not None and _ADM0_RE.fullmatch(adm0_a3):
            topo_codes.add(adm0_a3)
        topo_codes.add(iso3)
        if is_omitted_from_choropleth(iso3, policy) or (
            adm0_a3 is not None and is_omitted_from_choropleth(adm0_a3, policy)
        ) or (iso_a3 is not None and _ADM0_RE.fullmatch(iso_a3) and is_omitted_from_choropleth(iso_a3, policy)):
            continue
        feature = GeometryFeature(
            iso3=iso3,
            iso_a3=iso_a3,
            adm0_a3=adm0_a3,
            name=_prop_text(props.get("NAME")),
            name_en=_prop_text(props.get("NAME_EN")),
            continent=_prop_text(props.get("CONTINENT")),
            region_un=_prop_text(props.get("REGION_UN")),
            no_iso=no_iso,
        )
        previous = features.get(iso3)
        if previous is not None and previous != feature:
            raise GeometryError(f"duplicate geometry iso3 {iso3}")
        features[iso3] = feature

    return GeometryIndex(
        features=features,
        n_geometry_dropped=dropped,
        topo_codes=frozenset(topo_codes),
    )


def assert_has_geometry_in_topo(
    countries: list[dict[str, Any]] | tuple[dict[str, Any], ...],
    index: GeometryIndex,
) -> None:
    """Every has_geometry row must match ISO_A3, ADM0_A3, or an alias of those."""
    for row in countries:
        if not row.get("has_geometry"):
            continue
        iso3 = row["iso3"]
        if iso3 not in index.topo_codes:
            raise GeometryError(
                f"{iso3} has_geometry=true but is not ISO_A3/ADM0_A3 in TopoJSON"
            )
