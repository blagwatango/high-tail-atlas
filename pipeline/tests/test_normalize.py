from __future__ import annotations

import math

import pytest

from hightail.normalize import (
    UnmatchedReason,
    load_iso3_overrides,
    may_inherit_mu,
    resolve_row,
    resolve_token,
)


def test_kosovo_xkx_and_kos(overrides):
    assert resolve_token("XKX", overrides).iso3 == "XKX"
    assert resolve_token("KOS", overrides).iso3 == "XKX"
    assert resolve_token("xkx", overrides).iso3 == "XKX"
    for token in ("XKX", "KOS"):
        assert resolve_token(token, overrides).iso3 != "SRB"


def test_taiwan_twn_not_folded_into_chn(overrides):
    result = resolve_token("TWN", overrides)
    assert result.iso3 == "TWN"
    assert result.iso3 != "CHN"
    assert resolve_token("Taiwan", overrides).iso3 == "TWN"
    for source, dest in overrides.aliases.items():
        assert dest != "CHN" or source.strip().upper() not in {"TWN", "TAIWAN"}


def test_palestine_pse(overrides):
    result = resolve_token("PSE", overrides)
    assert result.iso3 == "PSE"
    assert result.iso3 != "ISR"


def test_namibia_nam(overrides):
    assert resolve_token("NAM", overrides).iso3 == "NAM"


def test_na_iso2_maps_to_nam(overrides):
    assert resolve_token("NA", overrides).iso3 == "NAM"
    assert overrides.iso2_overrides["NA"] == "NAM"
    assert resolve_row(iso3="NA", name=None, overrides=overrides).iso3 == "NAM"


def test_romania_rou_not_rom(overrides):
    assert resolve_token("ROM", overrides).iso3 == "ROU"
    assert resolve_token("ROU", overrides).iso3 == "ROU"
    assert resolve_token("ROM", overrides).iso3 != "ROM"


def test_never_map_congo(overrides):
    result = resolve_token("Congo", overrides)
    assert result.iso3 is None
    assert result.reason == UnmatchedReason.NEVER_MAP
    assert result.reason == "never_map"
    # Unambiguous names still resolve; bare "Congo" must not guess COD vs COG.
    assert resolve_token("DRC", overrides).iso3 == "COD"
    assert resolve_token("Republic of the Congo", overrides).iso3 == "COG"


@pytest.mark.parametrize(
    ("token", "iso3"),
    [
        ("South Korea", "KOR"),
        ("Korea, Republic of", "KOR"),
        ("Czechia", "CZE"),
        ("Czech Republic", "CZE"),
        ("Cape Verde", "CPV"),
        ("Eswatini", "SWZ"),
        ("Swaziland", "SWZ"),
        ("Turkey", "TUR"),
        ("Türkiye", "TUR"),
        ("Ivory Coast", "CIV"),
        ("Cote d'Ivoire", "CIV"),
        ("Congo, Democratic Republic of the", "COD"),
        ("KR", "KOR"),
        ("US", "USA"),
    ],
)
def test_alias_and_iso2_examples(overrides, token, iso3):
    assert resolve_token(token, overrides).iso3 == iso3


@pytest.mark.parametrize("token", ["Korea", "KOREA", "Guinea", "guinea"])
def test_never_map_korea_and_guinea(overrides, token):
    result = resolve_token(token, overrides)
    assert result.iso3 is None
    assert result.reason == UnmatchedReason.NEVER_MAP


def test_never_map_does_not_block_longer_names(overrides):
    assert resolve_token("Guinea-Bissau", overrides).iso3 == "GNB"
    assert resolve_token("Equatorial Guinea", overrides).iso3 == "GNQ"
    assert resolve_token("Papua New Guinea", overrides).iso3 == "PNG"


def test_unmapped_name_is_not_neighbor_imputed(overrides, policy):
    result = resolve_token("Atlantis", overrides)
    assert result.iso3 is None
    assert result.reason == UnmatchedReason.UNMAPPED_NAME
    assert may_inherit_mu("USA", "ATL", policy) is False


def test_invalid_iso3(overrides):
    result = resolve_token("ZZZ", overrides)
    assert result.iso3 is None
    assert result.reason == UnmatchedReason.INVALID_ISO3


def test_missing_tokens(overrides):
    assert resolve_token("", overrides).reason == UnmatchedReason.UNMAPPED_NAME
    assert resolve_token(None, overrides).reason == UnmatchedReason.UNMAPPED_NAME
    assert resolve_token(math.nan, overrides).reason == UnmatchedReason.UNMAPPED_NAME
    row = resolve_row(iso3=None, name=None, overrides=overrides)
    assert row.reason == UnmatchedReason.UNMAPPED_NAME


def test_row_iso3_wins_over_name(overrides):
    assert resolve_row(iso3="TWN", name="China", overrides=overrides).iso3 == "TWN"
    assert resolve_row(iso3=None, name="South Korea", overrides=overrides).iso3 == "KOR"


def test_overrides_file_validates():
    loaded = load_iso3_overrides()
    assert loaded.version == 1
    assert "Congo" in loaded.never_map
    assert "Korea" in loaded.never_map
    assert "Guinea" in loaded.never_map
