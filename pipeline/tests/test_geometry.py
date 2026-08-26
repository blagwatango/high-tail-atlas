from __future__ import annotations

import json
from pathlib import Path

import pytest

from hightail.emit import build_atlas
from hightail.geometry import (
    DEFAULT_GEOMETRY_PATH,
    GeometryError,
    load_geometry,
    resolve_geometry_iso3,
)
from hightail.ingest import ingest_estimates
from hightail.join import JoinError, join_frame
from hightail.normalize import load_iso3_overrides, load_territory_policy
from hightail.wpp import load_wpp_extract

REPO_ROOT = Path(__file__).resolve().parents[2]
DEMO_CSV = REPO_ROOT / "data" / "fixtures" / "demo_estimates.csv"
EXTRACT = REPO_ROOT / "data" / "raw" / "wpp_extract.csv"
TOPO = REPO_ROOT / "web" / "public" / "data" / "world-110m.topo.json"
MAX_TOPO_BYTES = 300_000

HEADER = (
    "iso3,name,mu,sigma,mu_se,source,source_url,source_year,"
    "sample_n,sample_type,quality,notes"
)


def _write_csv(path: Path, body: str) -> Path:
    path.write_text(HEADER + "\n" + body, encoding="utf-8")
    return path


def _write_topo(path: Path, geometries: list[dict]) -> Path:
    topo = {
        "type": "Topology",
        "objects": {
            "countries": {
                "type": "GeometryCollection",
                "geometries": geometries,
            }
        },
        "arcs": [],
    }
    path.write_text(json.dumps(topo), encoding="utf-8")
    return path


def _poly(iso_a3: str, adm0_a3: str, **extra) -> dict:
    props = {
        "ISO_A3": iso_a3,
        "ADM0_A3": adm0_a3,
        "NAME": extra.get("NAME", adm0_a3),
        "NAME_EN": extra.get("NAME_EN", extra.get("NAME", adm0_a3)),
        "CONTINENT": extra.get("CONTINENT", "Europe"),
        "REGION_UN": extra.get("REGION_UN", "Europe"),
    }
    return {"type": "Polygon", "arcs": [[[0, 1, 2]]], "properties": props}


def test_vendored_topojson_has_usa_omits_ata():
    assert TOPO.is_file()
    assert TOPO.stat().st_size < MAX_TOPO_BYTES
    topo = json.loads(TOPO.read_text(encoding="utf-8"))
    assert topo["type"] == "Topology"
    geoms = topo["objects"]["countries"]["geometries"]
    by_iso = {
        (g.get("properties") or {}).get("ISO_A3"): g
        for g in geoms
        if (g.get("properties") or {}).get("ISO_A3") not in {None, "-99"}
    }
    usa = by_iso["USA"]
    assert usa["type"] in {"Polygon", "MultiPolygon"}
    assert usa.get("arcs")
    assert (usa["properties"]["ISO_A3"] == "USA")
    assert usa["properties"]["ADM0_A3"] == "USA"
    assert not any(
        (g.get("properties") or {}).get("ISO_A3") == "ATA"
        or (g.get("properties") or {}).get("ADM0_A3") == "ATA"
        for g in geoms
    )


def test_load_geometry_usa_and_ata_and_no_drops():
    policy = load_territory_policy()
    overrides = load_iso3_overrides()
    index = load_geometry(DEFAULT_GEOMETRY_PATH, policy=policy, overrides=overrides)
    assert index.n_geometry_dropped == 0
    usa = index.get("USA")
    assert usa is not None
    assert usa.no_iso is False
    assert usa.continent == "North America"
    assert "ATA" not in index
    assert index.get("KOS") is None
    kosovo = index.get("XKX")
    assert kosovo is not None
    assert kosovo.no_iso is True
    assert kosovo.adm0_a3 == "KOS"


def test_iso_a3_minus_99_uses_adm0():
    iso3, no_iso, dropped = resolve_geometry_iso3("-99", "KOS")
    assert iso3 == "KOS"
    assert no_iso is True
    assert dropped is False
    iso3, no_iso, dropped = resolve_geometry_iso3(None, "CYN")
    assert iso3 == "CYN" and no_iso is True and dropped is False
    iso3, no_iso, dropped = resolve_geometry_iso3("", "SOL")
    assert iso3 == "SOL" and no_iso is True
    iso3, no_iso, dropped = resolve_geometry_iso3("USA", "USA")
    assert iso3 == "USA" and no_iso is False and dropped is False


def test_invalid_adm0_is_dropped():
    iso3, no_iso, dropped = resolve_geometry_iso3("-99", "??")
    assert iso3 is None and dropped is True
    iso3, no_iso, dropped = resolve_geometry_iso3("-99", None)
    assert dropped is True


def test_join_vendored_geometry_backfills_has_geometry():
    ingest = ingest_estimates(DEMO_CSV)
    wpp = load_wpp_extract(EXTRACT)
    policy = load_territory_policy()
    overrides = load_iso3_overrides()
    index = load_geometry(policy=policy, overrides=overrides)
    joined = join_frame(ingest, wpp, policy, geometry=index)
    assert joined.n_geometry_dropped == 0
    by_iso = {row["iso3"]: row for row in joined.countries}
    assert by_iso["USA"]["has_geometry"] is True
    assert by_iso["USA"]["status"] == "ok"
    assert "ATA" not in by_iso
    assert by_iso["XKX"]["status"] == "no_iso"
    assert by_iso["XKX"]["has_geometry"] is True
    assert by_iso["XKX"]["quality"] is None
    # Tiny WPP-only rows stay in the table without 110m polygons.
    assert by_iso["NRU"]["has_geometry"] is False


def test_direct_disputed_estimate_on_adm0_is_ok_with_geometry(tmp_path: Path):
    path = _write_csv(tmp_path / "cyn.csv", "CYN,Northern Cyprus,100,,,,,,,,\n")
    ingest = ingest_estimates(path)
    wpp = load_wpp_extract(EXTRACT)
    policy = load_territory_policy()
    overrides = load_iso3_overrides()
    index = load_geometry(policy=policy, overrides=overrides)
    joined = join_frame(ingest, wpp, policy, geometry=index)
    by_iso = {row["iso3"]: row for row in joined.countries}
    assert by_iso["CYN"]["status"] == "ok"
    assert by_iso["CYN"]["has_geometry"] is True
    assert by_iso["CYN"]["mu"] == 100
    assert by_iso["CYN"]["quality"] is not None


def test_dropped_geometry_fails_build(tmp_path: Path):
    topo = _write_topo(
        tmp_path / "bad.topo.json",
        [
            _poly("USA", "USA", NAME_EN="United States of America", CONTINENT="North America"),
            _poly("-99", "??", NAME="Dropped"),
        ],
    )
    estimates = _write_csv(tmp_path / "usa.csv", "USA,United States,100,,,,,,,,\n")
    out = tmp_path / "atlas.json"
    with pytest.raises(Exception, match="n_geometry_dropped"):
        build_atlas(
            estimates,
            EXTRACT,
            out,
            geometry_path=topo,
        )
    assert not out.exists()


def test_join_fails_on_dropped_feature(tmp_path: Path):
    topo = _write_topo(
        tmp_path / "bad.topo.json",
        [
            _poly("USA", "USA"),
            {"type": "Polygon", "arcs": [], "properties": {"ISO_A3": "-99", "ADM0_A3": ""}},
        ],
    )
    policy = load_territory_policy()
    overrides = load_iso3_overrides()
    index = load_geometry(topo, policy=policy, overrides=overrides)
    assert index.n_geometry_dropped == 1
    ingest = ingest_estimates(DEMO_CSV)
    wpp = load_wpp_extract(EXTRACT)
    with pytest.raises(JoinError, match="n_geometry_dropped=1"):
        join_frame(ingest, wpp, policy, geometry=index)


def test_ata_in_topo_is_omitted_not_dropped(tmp_path: Path):
    topo = _write_topo(
        tmp_path / "with-ata.topo.json",
        [
            _poly(
                "USA",
                "USA",
                NAME_EN="United States of America",
                CONTINENT="North America",
                REGION_UN="Americas",
            ),
            _poly("ATA", "ATA", NAME_EN="Antarctica", CONTINENT="Antarctica"),
        ],
    )
    policy = load_territory_policy()
    index = load_geometry(topo, policy=policy, overrides=load_iso3_overrides())
    assert index.n_geometry_dropped == 0
    assert "ATA" not in index
    assert "USA" in index


def test_missing_topojson_fails():
    policy = load_territory_policy()
    with pytest.raises(GeometryError, match="not found"):
        load_geometry(Path("/no/such/world-110m.topo.json"), policy=policy)
