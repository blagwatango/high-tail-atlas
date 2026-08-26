from __future__ import annotations

from pathlib import Path

import pytest

from hightail.cli import main
from hightail.ingest import IngestError, ingest_estimates

REPO_ROOT = Path(__file__).resolve().parents[2]
DEMO_CSV = REPO_ROOT / "data" / "fixtures" / "demo_estimates.csv"

HEADER = (
    "iso3,name,mu,sigma,mu_se,source,source_url,source_year,"
    "sample_n,sample_type,quality,notes"
)

REQUIRED_POPULOUS = {
    "USA",
    "CHN",
    "IND",
    "BRA",
    "NGA",
    "PAK",
    "IDN",
    "BGD",
    "RUS",
    "MEX",
    "JPN",
    "ETH",
    "PHL",
    "EGY",
    "DEU",
}

ALLOWED_MU = {90.0, 100.0, 110.0}


def _write_csv(path: Path, body: str, header: str = HEADER) -> Path:
    path.write_text(header + "\n" + body, encoding="utf-8")
    return path


def test_demo_csv_loads_at_least_15_ok_quality_c_rows():
    result = ingest_estimates(DEMO_CSV)
    iso3s = {row.iso3 for row in result.records}
    assert result.n_ok >= 15
    assert result.n_unmatched == 0
    assert REQUIRED_POPULOUS <= iso3s
    assert all(row.quality == "C" for row in result.records)
    assert all(row.mu in ALLOWED_MU for row in result.records)
    assert {row.mu for row in result.records} == ALLOWED_MU
    assert all(row.source == "DEMO_FIXTURE" for row in result.records)
    assert all(row.source_year == 2026 for row in result.records)
    assert all(row.sample_type == "convenience" for row in result.records)
    assert all(row.notes and "FABRICATED" in row.notes for row in result.records)
    assert all(row.quality != "D" for row in result.records)


def test_duplicate_iso3_fails(tmp_path: Path):
    path = _write_csv(
        tmp_path / "dup.csv",
        "USA,United States,100,,,,,,,,\nUSA,United States,110,,,,,,,,\n",
    )
    with pytest.raises(IngestError, match="duplicate ISO-3"):
        ingest_estimates(path)


def test_duplicate_after_name_normalize_fails(tmp_path: Path):
    path = _write_csv(
        tmp_path / "dup_name.csv",
        "USA,,100,,,,,,,,\n,United States,100,,,,,,,,\n",
    )
    with pytest.raises(IngestError, match="duplicate ISO-3"):
        ingest_estimates(path)


def test_extreme_mu_fails_without_flag(tmp_path: Path):
    path = _write_csv(tmp_path / "extreme.csv", "USA,United States,140,,,,,,,,\n")
    with pytest.raises(IngestError, match="allow-extreme-mu"):
        ingest_estimates(path)


def test_extreme_mu_allowed_is_quality_e(tmp_path: Path):
    path = _write_csv(
        tmp_path / "extreme_ok.csv",
        "USA,United States,140,,,,,2026,1,convenience,C,x\n",
    )
    result = ingest_estimates(path, allow_extreme_mu=True)
    assert result.n_ok == 1
    assert result.records[0].quality == "E"
    assert result.records[0].extreme_mu is True


def test_invalid_sample_type_fails(tmp_path: Path):
    path = _write_csv(
        tmp_path / "sample.csv",
        "USA,United States,100,,,,,2026,1,national,C,x\n",
    )
    with pytest.raises(IngestError, match="sample_type"):
        ingest_estimates(path)


def test_empty_source_url_does_not_fail(tmp_path: Path):
    path = _write_csv(
        tmp_path / "url.csv",
        "USA,United States,100,,,DEMO_FIXTURE,,2026,1,convenience,C,FABRICATED\n",
    )
    result = ingest_estimates(path)
    assert result.n_ok == 1
    assert result.records[0].source_url is None
    assert result.records[0].quality == "C"


def test_invalid_source_url_fails(tmp_path: Path):
    path = _write_csv(
        tmp_path / "bad_url.csv",
        "USA,United States,100,,,DEMO_FIXTURE,not-a-url,2026,1,convenience,C,x\n",
    )
    with pytest.raises(IngestError, match="source_url"):
        ingest_estimates(path)


def test_valid_source_url_is_kept(tmp_path: Path):
    path = _write_csv(
        tmp_path / "good_url.csv",
        "USA,United States,100,,,DEMO_FIXTURE,https://example.com/estimates,2026,1,convenience,C,x\n",
    )
    result = ingest_estimates(path)
    assert result.n_ok == 1
    assert result.records[0].source_url == "https://example.com/estimates"


def test_iso2_only_row_still_validates_source_url(tmp_path: Path):
    path = _write_csv(
        tmp_path / "iso2_url.csv",
        "US,,100,,,DEMO_FIXTURE,not-a-url,2026,1,convenience,C,x\n",
    )
    with pytest.raises(IngestError, match="source_url"):
        ingest_estimates(path)


def test_iso2_only_row_ingests(tmp_path: Path):
    path = _write_csv(tmp_path / "iso2.csv", "US,,100,,,,,,,,\n")
    result = ingest_estimates(path)
    assert result.n_ok == 1
    assert result.records[0].iso3 == "USA"


def test_whitespace_cells_are_omitted(tmp_path: Path):
    path = _write_csv(
        tmp_path / "ws.csv",
        "USA,United States,100,  ,  ,DEMO_FIXTURE,   ,2026,1,convenience,C,FABRICATED\n",
    )
    result = ingest_estimates(path)
    assert result.n_ok == 1
    assert result.records[0].sigma is None
    assert result.records[0].source_url is None


def test_missing_quality_is_assigned_from_sample_type(tmp_path: Path):
    path = _write_csv(
        tmp_path / "infer.csv",
        "USA,United States,100,,,,,2026,1,convenience,,FABRICATED\n",
    )
    result = ingest_estimates(path)
    assert result.records[0].quality == "C"


def test_unmatched_name_is_listed_not_invented(tmp_path: Path):
    path = _write_csv(
        tmp_path / "unmatched.csv",
        ",Atlantis,100,,,,,,,,\nUSA,United States,100,,,,,,,,\n",
    )
    result = ingest_estimates(path)
    assert {row.iso3 for row in result.records} == {"USA"}
    assert result.n_unmatched == 1
    assert result.unmatched[0].raw_name == "Atlantis"
    assert result.unmatched[0].reason == "unmapped_name"
    assert all(row.iso3 != "ATL" for row in result.records)


def test_never_map_congo_is_unmatched(tmp_path: Path):
    path = _write_csv(tmp_path / "congo.csv", ",Congo,100,,,,,,,,\n")
    result = ingest_estimates(path)
    assert result.n_ok == 0
    assert result.unmatched[0].reason == "never_map"


def test_does_not_impute_mu_from_neighbors(tmp_path: Path):
    path = _write_csv(tmp_path / "usa_only.csv", "USA,United States,100,,,,,,,,\n")
    result = ingest_estimates(path)
    assert {row.iso3 for row in result.records} == {"USA"}
    assert result.n_unmatched == 0


def test_sigma_out_of_range_fails(tmp_path: Path):
    path = _write_csv(tmp_path / "sigma.csv", "USA,United States,100,3,,,,,,,\n")
    with pytest.raises(IngestError, match="sigma"):
        ingest_estimates(path)


def test_sigma_outside_12_20_is_flagged(tmp_path: Path):
    path = _write_csv(tmp_path / "sigma_flag.csv", "USA,United States,100,10,,,,,,,\n")
    result = ingest_estimates(path)
    assert result.records[0].sigma_flag == "outside_12_20"


def test_cli_dry_run_demo(capsys: pytest.CaptureFixture[str]):
    code = main(
        [
            "ingest",
            "--dry-run",
            "--estimates",
            str(DEMO_CSV),
        ]
    )
    assert code == 0
    out = capsys.readouterr().out
    assert "ok: " in out
    assert "unmatched: 0" in out
    ok_line = next(line for line in out.splitlines() if line.startswith("ok:"))
    assert int(ok_line.split(":", 1)[1].strip()) >= 15


def test_cli_duplicate_fails(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    path = _write_csv(
        tmp_path / "dup.csv",
        "USA,United States,100,,,,,,,,\nUSA,United States,110,,,,,,,,\n",
    )
    code = main(["ingest", "--dry-run", "--estimates", str(path)])
    assert code == 1
    err = capsys.readouterr().err
    assert "duplicate ISO-3" in err
