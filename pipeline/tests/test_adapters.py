from __future__ import annotations

import math
import re
from pathlib import Path

import pytest

from hightail.adapters import (
    DEFAULT_IQ_METRIC_LABEL,
    LICENSE_ENV,
    PISA_METRIC_LABEL,
    AdapterLicenseError,
    load_becker,
    load_pisa,
)
from hightail.adapters.becker import transform_becker_rows
from hightail.adapters.pisa import PISA_THRESHOLD, pisa_to_pipeline_mu, transform_pisa_rows
from hightail.cli import main
from hightail.tails import tail_p
from scipy.stats import norm

ADAPTER_DIR = Path(__file__).resolve().parents[1] / "src" / "hightail" / "adapters"


def _write(path: Path, body: str) -> Path:
    path.write_text(body, encoding="utf-8")
    return path


@pytest.fixture
def no_license(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(LICENSE_ENV, raising=False)


def test_becker_aborts_without_license_flag(tmp_path: Path, no_license: None):
    path = _write(
        tmp_path / "fake_becker.csv",
        "iso3,name,mu,imputed\nZZZ,Fake Beckerland,50.5,0\n",
    )
    with pytest.raises(AdapterLicenseError, match="legal review"):
        load_becker(path)


def test_pisa_aborts_without_license_flag(tmp_path: Path, no_license: None):
    path = _write(
        tmp_path / "fake_pisa.csv",
        "iso3,name,pisa\nZZZ,Fake PISA West,321.0\n",
    )
    with pytest.raises(AdapterLicenseError, match="legal review"):
        load_pisa(path)


def test_aborts_without_local_path_even_with_license(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv(LICENSE_ENV, "1")
    with pytest.raises(AdapterLicenseError, match="local"):
        load_becker(None)
    with pytest.raises(AdapterLicenseError, match="local"):
        load_pisa("")


def test_rejects_url_and_does_not_download(monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv(LICENSE_ENV, "1")
    with pytest.raises(AdapterLicenseError, match="never download"):
        load_becker("https://example.com/niq.csv")
    with pytest.raises(AdapterLicenseError, match="never download"):
        load_pisa("https://example.com/pisa.csv")


def test_missing_local_file_does_not_download(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv(LICENSE_ENV, "1")
    missing = tmp_path / "not-here.csv"
    with pytest.raises(AdapterLicenseError, match="never download"):
        load_becker(missing)


def test_env_true_is_not_enough(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv(LICENSE_ENV, "true")
    path = _write(tmp_path / "x.csv", "iso3,mu\nZZZ,50.5\n")
    with pytest.raises(AdapterLicenseError, match="legal review"):
        load_becker(path)


def test_becker_neighbor_imputed_rows_are_quality_d(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv(LICENSE_ENV, "1")
    path = _write(
        tmp_path / "fake_becker.csv",
        "iso3,name,mu,imputed\n"
        "ZZZ,Fake Beckerland,50.5,0\n"
        "YYY,Fake Neighborland,50.5,1\n",
    )
    result = load_becker(path)
    by_iso = {row["iso3"]: row for row in result.rows}
    assert by_iso["YYY"]["quality"] == "D"
    assert by_iso["YYY"]["sample_type"] == "imputed"
    assert by_iso["ZZZ"]["quality"] is None
    assert by_iso["ZZZ"]["sample_type"] is None
    assert result.n_imputed == 1
    assert result.metric_label == DEFAULT_IQ_METRIC_LABEL


def test_becker_method_neighbor_text_is_imputed():
    result = transform_becker_rows(
        [
            {
                "iso3": "ZZZ",
                "name": "Fake Methodland",
                "mu": "50.5",
                "method": "neighbor average",
            }
        ]
    )
    assert result.rows[0]["quality"] == "D"
    assert result.rows[0]["sample_type"] == "imputed"


def test_pisa_sets_metric_label_away_from_iq(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv(LICENSE_ENV, "1")
    path = _write(
        tmp_path / "fake_pisa.csv",
        "iso3,name,pisa\n"
        "ZZZ,Fake PISA West,321.0\n"
        "YYY,Fake PISA East,654.0\n",
    )
    result = load_pisa(path)
    assert result.metric_label == PISA_METRIC_LABEL
    assert result.metric_label != DEFAULT_IQ_METRIC_LABEL
    assert "IQ ≥ 130" not in result.metric_label
    assert re.search(r"\bIQ\b", result.metric_label) is None
    assert "PISA" in result.metric_label
    assert all(row["sample_type"] == "students" for row in result.rows)
    assert all("not IQ" in (row["notes"] or "") for row in result.rows)
    scores = {row["iso3"]: row["mu"] for row in result.rows}
    assert scores["ZZZ"] == pytest.approx(pisa_to_pipeline_mu(321.0))
    assert scores["YYY"] == pytest.approx(pisa_to_pipeline_mu(654.0))


def test_pisa_in_memory_table_sets_metric_label():
    # Obviously fake PISA-like scores (~300–700 scale), not Lynn-like NIQ means.
    result = transform_pisa_rows(
        [
            {"iso3": "ZZZ", "name": "Fake PISA West", "pisa": "321.0"},
            {"iso3": "YYY", "name": "Fake PISA East", "pisa": "654.0"},
        ]
    )
    assert result.metric_label == PISA_METRIC_LABEL
    assert result.metric_label != DEFAULT_IQ_METRIC_LABEL
    assert re.search(r"\bIQ\b", result.metric_label) is None


def test_pisa_affine_map_matches_threshold_z():
    pisa_score = 321.0
    mu = pisa_to_pipeline_mu(pisa_score)
    left = tail_p(mu, 15.0, 130.0)
    right = float(norm.sf((PISA_THRESHOLD - pisa_score) / 100.0))
    assert math.isclose(left, right, rel_tol=0, abs_tol=1e-12)


def test_load_pisa_in_memory_rows_still_need_license_and_path(
    tmp_path: Path, no_license: None
):
    path = _write(tmp_path / "dummy.csv", "iso3,pisa\nZZZ,321.0\n")
    fake = [{"iso3": "ZZZ", "name": "Fake PISA West", "pisa": "321.0"}]
    with pytest.raises(AdapterLicenseError, match="legal review"):
        load_pisa(path, rows=fake)


def test_license_ok_kwarg_and_local_path(tmp_path: Path, no_license: None):
    path = _write(
        tmp_path / "fake_pisa.csv",
        "iso3,name,pisa\nZZZ,Fake PISA West,321.0\n",
    )
    result = load_pisa(path, license_ok=True)
    assert result.metric_label == PISA_METRIC_LABEL


def test_adapter_modules_do_not_import_downloaders():
    forbidden = ("urllib", "requests", "httpx", "urlretrieve", "urlopen")
    for name in ("becker.py", "pisa.py", "gate.py", "__init__.py"):
        src = (ADAPTER_DIR / name).read_text(encoding="utf-8")
        for token in forbidden:
            assert token not in src, f"{name} must not reference {token}"


def test_cli_adapter_becker_without_license(
    tmp_path: Path, no_license: None, capsys: pytest.CaptureFixture[str]
):
    path = _write(
        tmp_path / "fake_becker.csv",
        "iso3,name,mu,imputed\nZZZ,Fake Beckerland,50.5,0\n",
    )
    code = main(["adapter", "becker", "--source", str(path)])
    assert code == 1
    err = capsys.readouterr().err
    assert "legal review" in err
    assert "never download" in err or "HIGHTAIL_ADAPTER_LICENSE_OK" in err


def test_cli_adapter_pisa_with_license(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
):
    monkeypatch.setenv(LICENSE_ENV, "1")
    path = _write(
        tmp_path / "fake_pisa.csv",
        "iso3,name,pisa\nZZZ,Fake PISA West,321.0\n",
    )
    code = main(["adapter", "pisa", "--source", str(path)])
    assert code == 0
    out = capsys.readouterr().out
    assert "metric_label:" in out
    assert "PISA" in out
    assert "IQ ≥ 130" not in out
