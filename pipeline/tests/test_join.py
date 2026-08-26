from __future__ import annotations

from pathlib import Path

import pytest

from hightail.ingest import ingest_estimates
from hightail.join import JoinError, join_frame
from hightail.normalize import load_territory_policy
from hightail.tails import tail_p
from hightail.wpp import WppRow, load_wpp_extract

REPO_ROOT = Path(__file__).resolve().parents[2]
DEMO_CSV = REPO_ROOT / "data" / "fixtures" / "demo_estimates.csv"
EXTRACT = REPO_ROOT / "data" / "raw" / "wpp_extract.csv"

COVERAGE = ("USA", "CHN", "IND", "IDN", "PAK", "NGA", "BRA")
HEADER = (
    "iso3,name,mu,sigma,mu_se,source,source_url,source_year,"
    "sample_n,sample_type,quality,notes"
)


def _write_csv(path: Path, body: str) -> Path:
    path.write_text(HEADER + "\n" + body, encoding="utf-8")
    return path


def test_union_frame_has_ok_and_no_estimate():
    ingest = ingest_estimates(DEMO_CSV)
    wpp = load_wpp_extract(EXTRACT)
    joined = join_frame(ingest, wpp, load_territory_policy())
    by_iso = {row["iso3"]: row for row in joined.countries}
    for iso3 in COVERAGE:
        assert by_iso[iso3]["status"] == "ok"
        assert by_iso[iso3]["quality"] == "C"
        assert by_iso[iso3]["p_hat"] is not None
    assert by_iso["AFG"]["status"] == "no_estimate"
    assert by_iso["AFG"]["quality"] is None
    assert by_iso["AFG"]["mu"] is None
    assert by_iso["AFG"]["p_hat"] is None
    assert by_iso["NRU"]["tiny_population"] is True
    assert by_iso["USA"]["tiny_population"] is False
    assert all(row["has_geometry"] is False for row in joined.countries)


def test_name_prefers_estimates_then_wpp():
    ingest = ingest_estimates(DEMO_CSV)
    wpp = load_wpp_extract(EXTRACT)
    joined = join_frame(ingest, wpp, load_territory_policy())
    by_iso = {row["iso3"]: row for row in joined.countries}
    assert by_iso["USA"]["name"] == "United States"
    assert by_iso["AFG"]["name"] == "Afghanistan"


def test_does_not_impute_mu_from_neighbors():
    ingest = ingest_estimates(DEMO_CSV)
    wpp = load_wpp_extract(EXTRACT)
    joined = join_frame(ingest, wpp, load_territory_policy())
    by_iso = {row["iso3"]: row for row in joined.countries}
    assert by_iso["PAK"]["status"] == "ok"
    # AFG is adjacent in the extract on purpose; it must not inherit PAK's μ.
    assert by_iso["AFG"]["mu"] is None
    assert by_iso["AFG"]["status"] == "no_estimate"


def test_direct_disputed_estimate_is_ok_without_inheritance(tmp_path: Path):
    path = _write_csv(tmp_path / "sah.csv", "SAH,Western Sahara,100,,,,,,,,\n")
    ingest = ingest_estimates(path)
    wpp = load_wpp_extract(EXTRACT)
    joined = join_frame(ingest, wpp, load_territory_policy())
    by_iso = {row["iso3"]: row for row in joined.countries}
    assert by_iso["SAH"]["status"] == "ok"
    assert by_iso["SAH"]["mu"] == 100
    assert "MAR" not in by_iso or by_iso["MAR"]["mu"] is None


def test_unmatched_fails_closed(tmp_path: Path):
    path = _write_csv(
        tmp_path / "unmatched.csv",
        ",Atlantis,100,,,,,,,,\nUSA,United States,100,,,,,,,,\n",
    )
    ingest = ingest_estimates(path)
    wpp = load_wpp_extract(EXTRACT)
    with pytest.raises(JoinError, match="unmatched"):
        join_frame(ingest, wpp, load_territory_policy())
    joined = join_frame(
        ingest, wpp, load_territory_policy(), allow_unmatched=True
    )
    assert joined.n_unmatched == 1
    assert joined.unmatched[0].raw_name == "Atlantis"
    assert all(row["iso3"] != "ATL" for row in joined.countries)


def test_sigma_assumed_15_when_omitted(tmp_path: Path):
    path = _write_csv(tmp_path / "nosigma.csv", "USA,United States,100,,,,,,,,\n")
    ingest = ingest_estimates(path)
    wpp = load_wpp_extract(EXTRACT)
    joined = join_frame(ingest, wpp, load_territory_policy())
    usa = next(row for row in joined.countries if row["iso3"] == "USA")
    assert usa["sigma"] == 15
    assert usa["sigma_source"] == "assumed_15"
    assert usa["p_hat"] == pytest.approx(tail_p(100, 15), abs=1e-12)
    assert usa["p_lo_pm3"] is not None
    assert usa["p_hi_pm3"] is not None
    assert usa["p_lo_se"] is None


def test_se_bands_only_when_mu_se(tmp_path: Path):
    path = _write_csv(
        tmp_path / "se.csv",
        "USA,United States,100,15,1.5,,,,,,,\n",
    )
    ingest = ingest_estimates(path)
    wpp = load_wpp_extract(EXTRACT)
    joined = join_frame(ingest, wpp, load_territory_policy())
    usa = next(row for row in joined.countries if row["iso3"] == "USA")
    assert usa["mu_se"] == 1.5
    assert usa["p_lo_se"] is not None
    assert usa["p_hi_se"] is not None
    assert usa["p_lo_pm3"] is not None


def test_estimated_n_is_rounded_p_hat_times_population():
    ingest = ingest_estimates(DEMO_CSV)
    wpp = load_wpp_extract(EXTRACT)
    joined = join_frame(ingest, wpp, load_territory_policy())
    usa = next(row for row in joined.countries if row["iso3"] == "USA")
    assert usa["estimated_n_ge_130"] == round(usa["p_hat"] * usa["population"])


def test_continent_and_region_come_from_wpp():
    ingest = ingest_estimates(DEMO_CSV)
    wpp = load_wpp_extract(EXTRACT)
    joined = join_frame(ingest, wpp, load_territory_policy())
    usa = next(row for row in joined.countries if row["iso3"] == "USA")
    assert usa["continent"] == "Americas"
    assert usa["region_m49"] == "Northern America"


def test_estimate_without_wpp_stays_in_union(tmp_path: Path):
    path = _write_csv(tmp_path / "twn.csv", "TWN,Taiwan,100,,,,,,,,\n")
    ingest = ingest_estimates(path)
    wpp = {
        "USA": WppRow(
            iso3="USA",
            name="United States of America",
            population=347275807,
            pop_year=2025,
            variant="Medium",
            region_m49="Northern America",
            continent="Americas",
        )
    }
    joined = join_frame(ingest, wpp, load_territory_policy())
    by_iso = {row["iso3"]: row for row in joined.countries}
    assert by_iso["TWN"]["status"] == "ok"
    assert by_iso["TWN"]["population"] is None
    assert by_iso["USA"]["status"] == "no_estimate"
