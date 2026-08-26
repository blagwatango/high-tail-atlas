from __future__ import annotations

import json
import re
from pathlib import Path

import pytest
from jsonschema import Draft7Validator, FormatChecker

from hightail.cli import main
from hightail.emit import (
    ASSUMPTIONS,
    COVERAGE_ISO3,
    DEMO_DATASET_ID,
    EmitError,
    METRIC_LABEL,
    build_atlas,
)
from hightail.tails import tail_p

REPO_ROOT = Path(__file__).resolve().parents[2]
DEMO_CSV = REPO_ROOT / "data" / "fixtures" / "demo_estimates.csv"
EXTRACT = REPO_ROOT / "data" / "raw" / "wpp_extract.csv"
ATLAS_SCHEMA = REPO_ROOT / "data" / "schemas" / "atlas.schema.json"
COMMITTED = REPO_ROOT / "web" / "public" / "data" / "atlas.json"
OVERRIDES = REPO_ROOT / "data" / "overrides" / "iso3_overrides.yaml"
POLICY = REPO_ROOT / "data" / "overrides" / "territory_policy.yaml"

HEADER = (
    "iso3,name,mu,sigma,mu_se,source,source_url,source_year,"
    "sample_n,sample_type,quality,notes"
)
GOLDEN_SF2 = 0.022750131948179195
RFC3339 = re.compile(
    r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})$"
)


def _write_csv(path: Path, body: str) -> Path:
    path.write_text(HEADER + "\n" + body, encoding="utf-8")
    return path


def _schema():
    return json.loads(ATLAS_SCHEMA.read_text(encoding="utf-8"))


def test_build_demo_parses_as_atlas_file(tmp_path: Path):
    out = tmp_path / "atlas.json"
    atlas = build_atlas(
        DEMO_CSV,
        EXTRACT,
        out,
        created_at="2026-08-26T00:00:00Z",
    )
    Draft7Validator(_schema(), format_checker=FormatChecker()).validate(atlas)
    manifest = atlas["manifest"]
    assert manifest["schema_version"] == 1
    assert manifest["dataset_id"] == DEMO_DATASET_ID
    assert manifest["dataset_id"].startswith("demo-")
    assert manifest["threshold_iq"] == 130
    assert manifest["default_sigma"] == 15
    assert manifest["formula"] == "p = 1 - Phi((130 - mu) / sigma)"
    assert manifest["phi_implementation"] == "scipy.stats.norm.sf"
    assert manifest["metric_label"] == METRIC_LABEL
    assert manifest["flags"] == {
        "show_continuous_scale": False,
        "allow_quality_d": False,
        "demo_badge": True,
    }
    assert manifest["estimates_source"]["name"] == "DEMO_FIXTURE"
    assert manifest["geometry_source"].startswith("Natural Earth")
    assert manifest["assumptions"] == list(ASSUMPTIONS)
    assert set(manifest["n_quality"]) == {"A", "B", "C", "D", "E", "U"}
    assert manifest["n_quality"]["C"] == manifest["n_ok"] == 24
    assert manifest["n_unmatched"] == 0
    assert manifest["n_no_estimate"] >= 1
    assert RFC3339.match(manifest["created_at"])
    by_iso = {row["iso3"]: row for row in atlas["countries"]}
    for iso3 in COVERAGE_ISO3:
        assert by_iso[iso3]["status"] == "ok"
        assert by_iso[iso3]["has_geometry"] is True
    usa = by_iso["USA"]
    assert usa["p_hat"] == pytest.approx(GOLDEN_SF2, abs=1e-12)
    assert usa["p_hat"] == pytest.approx(tail_p(100, 15), abs=1e-12)
    assert usa["p_lo_pm3"] is not None
    assert usa["p_hi_pm3"] is not None
    assert usa["p_lo_se"] is None
    assert usa["source_short"] == "DEMO"
    assert usa["has_geometry"] is True
    assert "ATA" not in by_iso
    assert atlas["manifest"]["n_no_iso"] >= 1
    parsed = json.loads(out.read_text(encoding="utf-8"))
    assert parsed["manifest"]["n_ok"] == 24


def test_cli_build_unmatched_fails_without_flag(tmp_path: Path):
    estimates = _write_csv(
        tmp_path / "bad.csv",
        ",Atlantis,100,,,,,,,,\nUSA,United States,100,,,,,,,,\n",
    )
    out = tmp_path / "atlas.json"
    code = main(
        [
            "build",
            "--estimates",
            str(estimates),
            "--population",
            str(EXTRACT),
            "--out",
            str(out),
        ]
    )
    assert code == 1
    assert not out.exists()


def test_cli_build_allow_unmatched(tmp_path: Path):
    estimates = _write_csv(
        tmp_path / "bad.csv",
        ",Atlantis,100,,,,,,,,\nUSA,United States,100,,,,,,,,\n",
    )
    out = tmp_path / "atlas.json"
    code = main(
        [
            "build",
            "--estimates",
            str(estimates),
            "--population",
            str(EXTRACT),
            "--out",
            str(out),
            "--allow-unmatched",
        ]
    )
    assert code == 0
    atlas = json.loads(out.read_text(encoding="utf-8"))
    assert atlas["unmatched_estimates"][0]["raw_name"] == "Atlantis"
    assert atlas["unmatched_estimates"][0]["reason"] == "unmapped_name"


def test_cli_build_demo(tmp_path: Path, capsys: pytest.CaptureFixture[str]):
    out = tmp_path / "data" / "atlas.json"
    code = main(
        [
            "build",
            "--estimates",
            str(DEMO_CSV),
            "--population",
            str(EXTRACT),
            "--overrides",
            str(OVERRIDES),
            "--policy",
            str(POLICY),
            "--out",
            str(out),
            "--reference-year",
            "2025",
        ]
    )
    assert code == 0
    printed = capsys.readouterr().out
    assert "ok: 24" in printed
    assert "unmatched: 0" in printed
    atlas = json.loads(out.read_text(encoding="utf-8"))
    assert atlas["manifest"]["n_ok"] == 24


def test_refuses_src_public(tmp_path: Path):
    out = tmp_path / "web" / "src" / "public" / "data" / "atlas.json"
    with pytest.raises(EmitError, match="web/src/public"):
        build_atlas(DEMO_CSV, EXTRACT, out)


def test_committed_atlas_json():
    assert COMMITTED.is_file(), "web/public/data/atlas.json must be committed"
    atlas = json.loads(COMMITTED.read_text(encoding="utf-8"))
    Draft7Validator(_schema(), format_checker=FormatChecker()).validate(atlas)
    assert atlas["manifest"]["dataset_id"].startswith("demo-")
    assert atlas["manifest"]["flags"]["demo_badge"] is True
    assert atlas["manifest"]["flags"]["allow_quality_d"] is False
    assert atlas["manifest"]["flags"]["show_continuous_scale"] is False
    assert "src" not in COMMITTED.parts or COMMITTED.parts[COMMITTED.parts.index("src") - 1] == "web"
    assert COMMITTED.as_posix().endswith("web/public/data/atlas.json")
    by_iso = {row["iso3"]: row for row in atlas["countries"]}
    for iso3 in COVERAGE_ISO3:
        assert by_iso[iso3]["status"] == "ok"
        assert by_iso[iso3]["has_geometry"] is True
    assert by_iso["USA"]["has_geometry"] is True
    assert "ATA" not in by_iso
    assert atlas["unmatched_estimates"] == []
    assert RFC3339.match(atlas["manifest"]["created_at"])
    assert atlas["manifest"]["geometry_source"].startswith("Natural Earth")
