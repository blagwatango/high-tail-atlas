"""ISO-3 join-key normalization and disputed-territory policy.

Country means are never filled from neighbors or sovereigns.
"""

from __future__ import annotations

import json
import math
import re
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from typing import Mapping

import pycountry
import yaml
from jsonschema import Draft7Validator

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_OVERRIDES = _REPO_ROOT / "data" / "overrides" / "iso3_overrides.yaml"
_DEFAULT_OVERRIDES_SCHEMA = _REPO_ROOT / "data" / "schemas" / "iso3_overrides.schema.json"
_DEFAULT_POLICY = _REPO_ROOT / "data" / "overrides" / "territory_policy.yaml"
_DEFAULT_POLICY_SCHEMA = _REPO_ROOT / "data" / "schemas" / "territory_policy.schema.json"

_ISO2_RE = re.compile(r"^[A-Z]{2}$")
_ISO3_RE = re.compile(r"^[A-Z]{3}$")
_ADM0_RE = re.compile(r"^[A-Z0-9]{3}$")

# pandas/JSON missing sentinels. "NA" is Namibia's ISO-2 and must not appear here.
_MISSING_TEXT = frozenset({"", "nan", "none", "<na>", "<n/a>", "nat", "null"})


class UnmatchedReason(StrEnum):
    UNMAPPED_NAME = "unmapped_name"
    INVALID_ISO3 = "invalid_iso3"
    AMBIGUOUS_NAME = "ambiguous_name"
    NEVER_MAP = "never_map"


@dataclass(frozen=True)
class NormalizeResult:
    iso3: str | None = None
    reason: UnmatchedReason | None = None

    @property
    def matched(self) -> bool:
        return self.iso3 is not None


@dataclass(frozen=True)
class Iso3Overrides:
    version: int
    aliases: Mapping[str, str]
    never_map: frozenset[str]
    iso2_overrides: Mapping[str, str]
    _alias_lookup: Mapping[str, str]
    _never_map_folded: frozenset[str]


@dataclass(frozen=True)
class TerritoryPolicy:
    version: int
    geometry_viewpoint: str
    inherit_mu_to_disputed: bool
    omit_from_choropleth: frozenset[str]
    excluded_territory_iso3: frozenset[str]
    disputed_no_estimate_adm0_a3: frozenset[str]
    notes: str | None = None


def _validate(instance: object, schema_path: Path) -> None:
    schema = json.loads(schema_path.read_text(encoding="utf-8"))
    Draft7Validator(schema).validate(instance)


def _load_yaml(path: Path) -> object:
    with path.open(encoding="utf-8") as handle:
        return yaml.safe_load(handle)


def load_iso3_overrides(
    path: Path | str | None = None,
    *,
    schema_path: Path | str | None = None,
) -> Iso3Overrides:
    overrides_path = Path(path) if path is not None else _DEFAULT_OVERRIDES
    schema = Path(schema_path) if schema_path is not None else _DEFAULT_OVERRIDES_SCHEMA
    raw = _load_yaml(overrides_path)
    _validate(raw, schema)
    if not isinstance(raw, dict):
        raise ValueError(f"iso3 overrides must be a mapping: {overrides_path}")

    aliases = {str(key): str(value) for key, value in raw["aliases"].items()}
    lookup: dict[str, str] = {}
    for key, value in aliases.items():
        lookup[key] = value
        lookup[key.strip().casefold()] = value
        lookup[key.strip().upper()] = value

    never_map = frozenset(str(item) for item in raw["never_map"])
    iso2 = {str(key).upper(): str(value) for key, value in raw["iso2_overrides"].items()}
    return Iso3Overrides(
        version=int(raw["version"]),
        aliases=aliases,
        never_map=never_map,
        iso2_overrides=iso2,
        _alias_lookup=lookup,
        _never_map_folded=frozenset(item.casefold() for item in never_map),
    )


def load_territory_policy(
    path: Path | str | None = None,
    *,
    schema_path: Path | str | None = None,
) -> TerritoryPolicy:
    policy_path = Path(path) if path is not None else _DEFAULT_POLICY
    schema = Path(schema_path) if schema_path is not None else _DEFAULT_POLICY_SCHEMA
    raw = _load_yaml(policy_path)
    _validate(raw, schema)
    if not isinstance(raw, dict):
        raise ValueError(f"territory policy must be a mapping: {policy_path}")

    policy = TerritoryPolicy(
        version=int(raw["version"]),
        geometry_viewpoint=str(raw["geometry_viewpoint"]),
        inherit_mu_to_disputed=bool(raw["inherit_mu_to_disputed"]),
        omit_from_choropleth=frozenset(str(item) for item in raw["omit_from_choropleth"]),
        excluded_territory_iso3=frozenset(
            str(item) for item in raw["excluded_territory_iso3"]
        ),
        disputed_no_estimate_adm0_a3=frozenset(
            str(item) for item in raw["disputed_no_estimate_adm0_a3"]
        ),
        notes=raw.get("notes"),
    )
    if policy.inherit_mu_to_disputed:
        raise ValueError(
            "inherit_mu_to_disputed must remain false; "
            "disputed polygons must not inherit a sovereign μ"
        )
    return policy


def _token_text(value: object) -> str | None:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    text = str(value).strip()
    if text.casefold() in _MISSING_TEXT:
        return None
    return text


def _alias_match(token: str, overrides: Iso3Overrides) -> str | None:
    lookup = overrides._alias_lookup
    return lookup.get(token) or lookup.get(token.casefold()) or lookup.get(token.upper())


def _pycountry_alpha2(code: str) -> str | None:
    country = pycountry.countries.get(alpha_2=code)
    if country is None:
        return None
    return country.alpha_3


def _pycountry_alpha3(code: str) -> str | None:
    # Current ISO 3166-1 only. Withdrawn codes such as ROM must go through aliases.
    country = pycountry.countries.get(alpha_3=code)
    if country is None:
        return None
    return country.alpha_3


def _pycountry_name(name: str) -> str | None:
    try:
        country = pycountry.countries.lookup(name)
    except LookupError:
        return None
    return country.alpha_3


def resolve_token(
    token: object,
    overrides: Iso3Overrides,
    *,
    policy: TerritoryPolicy | None = None,
) -> NormalizeResult:
    """Map a name, ISO-2, or non-canonical ISO-3 to a canonical ISO-3 join key."""
    text = _token_text(token)
    if text is None:
        return NormalizeResult(reason=UnmatchedReason.UNMAPPED_NAME)

    if text.casefold() in overrides._never_map_folded:
        return NormalizeResult(reason=UnmatchedReason.NEVER_MAP)

    aliased = _alias_match(text, overrides)
    if aliased is not None:
        return NormalizeResult(iso3=aliased)

    upper = text.upper()

    if _ISO2_RE.fullmatch(upper):
        iso3 = _pycountry_alpha2(upper)
        if iso3 is not None:
            return NormalizeResult(iso3=iso3)
        overridden = overrides.iso2_overrides.get(upper)
        if overridden is not None:
            return NormalizeResult(iso3=overridden)
        return NormalizeResult(reason=UnmatchedReason.INVALID_ISO3)

    if _ISO3_RE.fullmatch(upper):
        iso3 = _pycountry_alpha3(upper)
        if iso3 is not None:
            return NormalizeResult(iso3=iso3)
        if policy is not None and upper in policy.disputed_no_estimate_adm0_a3:
            return NormalizeResult(iso3=upper)
        return NormalizeResult(reason=UnmatchedReason.INVALID_ISO3)

    if _ADM0_RE.fullmatch(upper):
        if policy is not None and upper in policy.disputed_no_estimate_adm0_a3:
            return NormalizeResult(iso3=upper)
        return NormalizeResult(reason=UnmatchedReason.INVALID_ISO3)

    named = _pycountry_name(text)
    if named is not None:
        return NormalizeResult(iso3=named)

    return NormalizeResult(reason=UnmatchedReason.UNMAPPED_NAME)


def resolve_row(
    iso3: object = None,
    name: object = None,
    overrides: Iso3Overrides | None = None,
    *,
    policy: TerritoryPolicy | None = None,
) -> NormalizeResult:
    """Resolve an estimate row. An explicit iso3/code token wins over name."""
    if overrides is None:
        raise TypeError("overrides is required")

    code = _token_text(iso3)
    if code is not None:
        return resolve_token(code, overrides, policy=policy)

    label = _token_text(name)
    if label is not None:
        return resolve_token(label, overrides, policy=policy)

    return NormalizeResult(reason=UnmatchedReason.UNMAPPED_NAME)


def may_inherit_mu(
    from_iso3: str,
    to_iso3: str,
    policy: TerritoryPolicy,
) -> bool:
    """Neighbor and sovereign μ inheritance is forbidden."""
    if policy.inherit_mu_to_disputed:
        raise ValueError("inherit_mu_to_disputed must remain false")
    return False


def allows_direct_estimate(iso3_or_adm0: str, policy: TerritoryPolicy) -> bool:
    """A matching estimate row is allowed even on disputed ADM0_A3 features."""
    code = iso3_or_adm0.upper()
    if code in policy.excluded_territory_iso3:
        return False
    return True


def is_omitted_from_choropleth(iso3: str, policy: TerritoryPolicy) -> bool:
    return iso3.upper() in policy.omit_from_choropleth


def is_excluded_territory(iso3: str, policy: TerritoryPolicy) -> bool:
    return iso3.upper() in policy.excluded_territory_iso3


def is_disputed_no_estimate(adm0_a3: str, policy: TerritoryPolicy) -> bool:
    return adm0_a3.upper() in policy.disputed_no_estimate_adm0_a3
