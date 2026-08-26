from __future__ import annotations

from pathlib import Path

import pytest

from hightail.wpp import (
    extract_row_from_compact,
    load_wpp_extract,
    persons_from_thousands,
    sha256_file,
)

REPO_ROOT = Path(__file__).resolve().parents[2]
EXTRACT = REPO_ROOT / "data" / "raw" / "wpp_extract.csv"
DEMO_CSV = REPO_ROOT / "data" / "fixtures" / "demo_estimates.csv"
PIN = REPO_ROOT / "data" / "raw" / "WPP_PIN.txt"

DEMO_ISO3 = {
    "USA",
    "CHN",
    "IND",
    "IDN",
    "PAK",
    "NGA",
    "BRA",
    "BGD",
    "RUS",
    "MEX",
    "JPN",
    "ETH",
    "PHL",
    "EGY",
    "VNM",
    "DEU",
    "TUR",
    "FRA",
    "GBR",
    "ITA",
    "COL",
    "ZAF",
    "CAN",
    "KOR",
}

NO_ESTIMATE_ISO3 = {
    "AFG",
    "ARG",
    "AUS",
    "KEN",
    "ESP",
    "POL",
    "UKR",
    "DZA",
    "NRU",
    "TUV",
}


def test_thousands_to_persons_matches_design_usa():
    # Design-doc WPP 2024 Medium 2025 USA: 347275.807 thousands → 347275807 persons.
    assert persons_from_thousands(347275.807) == 347275807
    assert persons_from_thousands("347275.807") == 347275807


def test_thousands_to_persons_rounds():
    assert persons_from_thousands(1.0) == 1000
    assert persons_from_thousands(0.4) == 400
    assert persons_from_thousands("12.025") == 12025


def test_compact_blank_iso3_is_skipped():
    raw = {
        "ISO3_code": "",
        "Location": "World",
        "Time": "2025",
        "Variant": "Medium",
        "PopTotal": "8231613.070",
    }
    assert extract_row_from_compact(raw) is None


def test_compact_medium_2025_converts_thousands():
    raw = {
        "ISO3_code": "USA",
        "Location": "United States of America",
        "Time": "2025",
        "Variant": "Medium",
        "PopTotal": "347275.807",
    }
    row = extract_row_from_compact(raw)
    assert row is not None
    assert row.iso3 == "USA"
    assert row.population == 347275807
    assert row.variant == "Medium"
    assert row.pop_year == 2025
    assert row.continent == "Americas"
    assert row.region_m49 == "Northern America"


def test_compact_skips_other_years_and_variants():
    base = {
        "ISO3_code": "USA",
        "Location": "United States of America",
        "PopTotal": "347275.807",
    }
    assert extract_row_from_compact({**base, "Time": "2024", "Variant": "Medium"}) is None
    assert extract_row_from_compact({**base, "Time": "2025", "Variant": "High"}) is None


def test_owid_persons_not_multiplied():
    raw = {
        "Code": "NRU",
        "Entity": "Nauru",
        "Year": "2025",
        "Population": "12025",
    }
    row = extract_row_from_compact(raw, pop_in_thousands=False)
    assert row is not None
    assert row.population == 12025


def test_extract_covers_demo_and_no_estimate_iso3s():
    wpp = load_wpp_extract(EXTRACT)
    assert DEMO_ISO3 <= set(wpp)
    assert NO_ESTIMATE_ISO3 <= set(wpp)
    assert wpp["USA"].population == 347275807
    assert wpp["NRU"].population < 250_000
    assert wpp["TUV"].population < 250_000
    assert all(row.variant == "Medium" for row in wpp.values())
    assert all(row.pop_year == 2025 for row in wpp.values())


def test_extract_includes_all_demo_csv_iso3s():
    iso3s = set()
    for line in DEMO_CSV.read_text(encoding="utf-8").splitlines()[1:]:
        if line.strip():
            iso3s.add(line.split(",", 1)[0])
    wpp = load_wpp_extract(EXTRACT)
    assert iso3s <= set(wpp)


def test_pin_file_cites_un_desa():
    text = PIN.read_text(encoding="utf-8")
    assert "United Nations" in text
    assert "DESA" in text
    assert "2024" in text
    assert "sha256:" in text.casefold()
    digest = sha256_file(EXTRACT)
    assert digest in text.casefold()
