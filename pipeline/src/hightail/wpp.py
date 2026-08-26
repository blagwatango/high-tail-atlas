"""UN WPP extract load, unit conversion, and M49 region lookup.

PopTotal in DESA compact files is thousands of persons. The extract stores
integer persons: round(PopTotal * 1000). Missing country means are never
filled here; this module is population geography only.
"""

from __future__ import annotations

import csv
import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Mapping

from jsonschema import Draft7Validator

_REPO_ROOT = Path(__file__).resolve().parents[3]
_DEFAULT_EXTRACT = _REPO_ROOT / "data" / "raw" / "wpp_extract.csv"
_DEFAULT_SCHEMA = _REPO_ROOT / "data" / "schemas" / "wpp_extract.schema.json"
_DEFAULT_PIN = _REPO_ROOT / "data" / "raw" / "WPP_PIN.txt"

EXTRACT_COLUMNS = (
    "iso3",
    "name",
    "population",
    "pop_year",
    "variant",
    "region_m49",
    "continent",
)
CONTINENTS = frozenset({"Africa", "Americas", "Asia", "Europe", "Oceania"})
MEDIUM_VARIANT = "Medium"
DEFAULT_REFERENCE_YEAR = 2025

# UN M49 intermediate region → geographic continent used by the atlas filters.
_REGION_CONTINENT: dict[str, str] = {
    "Northern Africa": "Africa",
    "Eastern Africa": "Africa",
    "Middle Africa": "Africa",
    "Southern Africa": "Africa",
    "Western Africa": "Africa",
    "Caribbean": "Americas",
    "Central America": "Americas",
    "South America": "Americas",
    "Northern America": "Americas",
    "Central Asia": "Asia",
    "Eastern Asia": "Asia",
    "South-Eastern Asia": "Asia",
    "Southern Asia": "Asia",
    "Western Asia": "Asia",
    "Eastern Europe": "Europe",
    "Northern Europe": "Europe",
    "Southern Europe": "Europe",
    "Western Europe": "Europe",
    "Australia and New Zealand": "Oceania",
    "Melanesia": "Oceania",
    "Micronesia": "Oceania",
    "Polynesia": "Oceania",
}


def _codes(region: str, continent: str, iso3s: str) -> dict[str, tuple[str, str]]:
    return {code: (region, continent) for code in iso3s.split()}


# UN M49 region membership for ISO 3166-1 alpha-3 (and XKX). Not IQ data.
ISO3_M49: dict[str, tuple[str, str]] = {}
ISO3_M49.update(
    _codes(
        "Northern Africa",
        "Africa",
        "DZA EGY ESH LBY MAR SDN TUN",
    )
)
ISO3_M49.update(
    _codes(
        "Eastern Africa",
        "Africa",
        "BDI COM DJI ERI ETH KEN MDG MWI MUS MYT MOZ REU RWA SYC SOM SSD UGA TZA ZMB ZWE",
    )
)
ISO3_M49.update(
    _codes("Middle Africa", "Africa", "AGO CMR CAF TCD COG COD GNQ GAB STP")
)
ISO3_M49.update(_codes("Southern Africa", "Africa", "BWA SWZ LSO NAM ZAF"))
ISO3_M49.update(
    _codes(
        "Western Africa",
        "Africa",
        "BEN BFA CPV CIV GMB GHA GIN GNB LBR MLI MRT NER NGA SHN SEN SLE TGO",
    )
)
ISO3_M49.update(
    _codes(
        "Caribbean",
        "Americas",
        "AIA ATG ABW BHS BRB BES VGB CYM CUB CUW DMA DOM GRD GLP HTI JAM MTQ MSR PRI BLM KNA LCA MAF VCT SXM TTO TCA VIR",
    )
)
ISO3_M49.update(
    _codes("Central America", "Americas", "BLZ CRI SLV GTM HND MEX NIC PAN")
)
ISO3_M49.update(
    _codes(
        "South America",
        "Americas",
        "ARG BOL BRA CHL COL ECU FLK GUF GUY PRY PER SUR URY VEN",
    )
)
ISO3_M49.update(_codes("Northern America", "Americas", "BMU CAN GRL SPM USA"))
ISO3_M49.update(_codes("Central Asia", "Asia", "KAZ KGZ TJK TKM UZB"))
ISO3_M49.update(_codes("Eastern Asia", "Asia", "CHN HKG MAC TWN PRK JPN MNG KOR"))
ISO3_M49.update(
    _codes(
        "South-Eastern Asia",
        "Asia",
        "BRN KHM IDN LAO MYS MMR PHL SGP THA TLS VNM",
    )
)
ISO3_M49.update(
    _codes("Southern Asia", "Asia", "AFG BGD BTN IND IRN MDV NPL PAK LKA")
)
ISO3_M49.update(
    _codes(
        "Western Asia",
        "Asia",
        "ARM AZE BHR CYP GEO IRQ ISR JOR KWT LBN OMN QAT SAU PSE SYR TUR ARE YEM",
    )
)
ISO3_M49.update(
    _codes("Eastern Europe", "Europe", "BLR BGR CZE HUN POL MDA ROU RUS SVK UKR")
)
ISO3_M49.update(
    _codes(
        "Northern Europe",
        "Europe",
        "DNK EST FRO FIN GGY ISL IRL IMN JEY LVA LTU NOR SWE GBR SJM ALA",
    )
)
ISO3_M49.update(
    _codes(
        "Southern Europe",
        "Europe",
        "ALB AND BIH HRV GIB GRC VAT ITA XKX MLT MNE MKD PRT SMR SRB SVN ESP",
    )
)
ISO3_M49.update(
    _codes("Western Europe", "Europe", "AUT BEL FRA DEU LIE LUX MCO NLD CHE")
)
ISO3_M49.update(_codes("Australia and New Zealand", "Oceania", "AUS NZL NFK"))
ISO3_M49.update(_codes("Melanesia", "Oceania", "FJI NCL PNG SLB VUT"))
ISO3_M49.update(_codes("Micronesia", "Oceania", "GUM KIR MHL FSM NRU MNP PLW"))
ISO3_M49.update(
    _codes("Polynesia", "Oceania", "ASM COK PYF NIU WSM TKL TON TUV WLF")
)


class WppError(ValueError):
    """Invalid WPP extract or compact input."""


@dataclass(frozen=True)
class WppRow:
    iso3: str
    name: str
    population: int
    pop_year: int
    variant: str
    region_m49: str
    continent: str

    def as_dict(self) -> dict[str, str | int]:
        return {
            "iso3": self.iso3,
            "name": self.name,
            "population": self.population,
            "pop_year": self.pop_year,
            "variant": self.variant,
            "region_m49": self.region_m49,
            "continent": self.continent,
        }


def persons_from_thousands(pop_total: float | int | str) -> int:
    """Convert DESA PopTotal (thousands of persons) to integer persons."""
    if isinstance(pop_total, str):
        text = pop_total.strip().replace(" ", "").replace(",", "")
        if text == "":
            raise WppError("PopTotal is empty")
        value = float(text)
    else:
        value = float(pop_total)
    if value < 0 or value != value:  # NaN check
        raise WppError(f"PopTotal must be a non-negative number, got {pop_total!r}")
    return int(round(value * 1000.0))


def m49_for_iso3(iso3: str) -> tuple[str, str] | None:
    return ISO3_M49.get(iso3.upper())


def continent_for_region(region_m49: str) -> str | None:
    return _REGION_CONTINENT.get(region_m49)


def sha256_file(path: Path | str) -> str:
    # Normalize CRLF so the pin matches under core.autocrlf=true.
    data = Path(path).read_bytes().replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def parse_pin_sha256(pin_path: Path | str | None = None) -> str | None:
    path = Path(pin_path) if pin_path is not None else _DEFAULT_PIN
    if not path.is_file():
        return None
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if stripped.lower().startswith("sha256:"):
            return stripped.split(":", 1)[1].strip().lower()
    return None


def _load_extract_validator(schema_path: Path) -> Draft7Validator:
    root = json.loads(schema_path.read_text(encoding="utf-8"))
    return Draft7Validator(root)


def load_wpp_extract(
    path: Path | str | None = None,
    *,
    schema_path: Path | str | None = None,
    reference_year: int = DEFAULT_REFERENCE_YEAR,
) -> dict[str, WppRow]:
    """Load one-row-per-ISO-3 extract. Population is already persons."""
    csv_path = Path(path) if path is not None else _DEFAULT_EXTRACT
    if not csv_path.is_file():
        raise WppError(f"WPP extract not found: {csv_path}")

    validator = _load_extract_validator(
        Path(schema_path) if schema_path is not None else _DEFAULT_SCHEMA
    )
    rows: dict[str, WppRow] = {}
    instances: list[dict[str, str | int]] = []

    with csv_path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise WppError("WPP extract must have a header row")
        missing = [col for col in EXTRACT_COLUMNS if col not in reader.fieldnames]
        if missing:
            raise WppError(f"WPP extract missing columns: {', '.join(missing)}")
        for line_no, raw in enumerate(reader, start=2):
            iso3 = (raw.get("iso3") or "").strip().upper()
            if not iso3:
                continue
            name = (raw.get("name") or "").strip()
            variant = (raw.get("variant") or "").strip()
            region = (raw.get("region_m49") or "").strip()
            continent = (raw.get("continent") or "").strip()
            try:
                population = int(str(raw.get("population") or "").strip())
                pop_year = int(str(raw.get("pop_year") or "").strip())
            except ValueError as exc:
                raise WppError(f"row {line_no}: population/pop_year must be integers") from exc
            row = WppRow(
                iso3=iso3,
                name=name,
                population=population,
                pop_year=pop_year,
                variant=variant,
                region_m49=region,
                continent=continent,
            )
            if row.iso3 in rows:
                raise WppError(f"duplicate ISO-3 in WPP extract: {row.iso3}")
            if row.variant != MEDIUM_VARIANT:
                raise WppError(f"row {line_no}: variant must be Medium, got {row.variant!r}")
            if row.pop_year != reference_year:
                raise WppError(
                    f"row {line_no}: pop_year {row.pop_year} != reference year {reference_year}"
                )
            rows[row.iso3] = row
            instances.append(row.as_dict())

    validator.validate(instances)
    if not rows:
        raise WppError(f"WPP extract has no ISO-3 rows: {csv_path}")
    return rows


def write_wpp_extract(rows: Iterable[WppRow], path: Path | str) -> None:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(rows, key=lambda row: row.iso3)
    with out.open("w", encoding="utf-8", newline="\n") as handle:
        writer = csv.DictWriter(handle, fieldnames=EXTRACT_COLUMNS, lineterminator="\n")
        writer.writeheader()
        for row in ordered:
            writer.writerow(row.as_dict())


def compact_cell(raw: Mapping[str, str], *names: str) -> str:
    lower = {key.lower(): (value or "").strip() for key, value in raw.items() if key}
    for name in names:
        value = lower.get(name.lower())
        if value:
            return value
    return ""


def extract_row_from_compact(
    raw: Mapping[str, str],
    *,
    reference_year: int = DEFAULT_REFERENCE_YEAR,
    pop_in_thousands: bool = True,
) -> WppRow | None:
    """Parse one DESA compact (or OWID-like) row into extract form, or None to skip.

    DESA compact ``PopTotal`` is thousands of persons. Processed OWID files are
    already persons — pass ``pop_in_thousands=False`` for that fallback.
    """
    iso3 = compact_cell(raw, "ISO3_code", "iso3", "Code", "code").upper()
    if len(iso3) != 3 or not iso3.isalpha():
        return None
    time_text = compact_cell(raw, "Time", "Year", "year", "time")
    if time_text and int(float(time_text)) != reference_year:
        return None
    variant = compact_cell(raw, "Variant", "variant") or MEDIUM_VARIANT
    if variant.casefold() not in {MEDIUM_VARIANT.casefold(), "medium variant", ""}:
        return None
    name = compact_cell(raw, "Location", "Entity", "name", "location")
    if not name:
        name = iso3
    pop_text = compact_cell(
        raw,
        "PopTotal",
        "TPopulation1July",
        "population",
        "Population (historical estimates)",
        "Population",
    )
    if not pop_text:
        return None
    pop_value = float(pop_text.replace(" ", "").replace(",", ""))
    population = (
        persons_from_thousands(pop_value) if pop_in_thousands else int(round(pop_value))
    )
    placed = m49_for_iso3(iso3)
    if placed is None:
        return None
    region_m49, continent = placed
    return WppRow(
        iso3=iso3,
        name=name,
        population=population,
        pop_year=reference_year,
        variant=MEDIUM_VARIANT,
        region_m49=region_m49,
        continent=continent,
    )
