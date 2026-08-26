from __future__ import annotations

from hightail.normalize import (
    allows_direct_estimate,
    is_disputed_no_estimate,
    is_excluded_territory,
    is_omitted_from_choropleth,
    load_territory_policy,
    may_inherit_mu,
    resolve_token,
)


def test_inherit_mu_to_disputed_is_false(policy):
    assert policy.inherit_mu_to_disputed is False
    assert may_inherit_mu("MAR", "SAH", policy) is False
    assert may_inherit_mu("FRA", "GUF", policy) is False
    assert may_inherit_mu("CHN", "TWN", policy) is False


def test_omit_antarctica_from_choropleth(policy):
    assert "ATA" in policy.omit_from_choropleth
    assert is_omitted_from_choropleth("ATA", policy)
    assert policy.excluded_territory_iso3 == frozenset()
    assert not is_excluded_territory("USA", policy)


def test_direct_estimate_for_disputed_adm0_is_ok(overrides, policy):
    for adm0 in ("B57", "KAS", "CYN", "SAH"):
        assert is_disputed_no_estimate(adm0, policy)
        assert allows_direct_estimate(adm0, policy)
        # Direct row keeps the ADM0 join key; it is not rewritten to a sovereign.
        result = resolve_token(adm0, overrides, policy=policy)
        assert result.iso3 == adm0
        assert may_inherit_mu("MAR", adm0, policy) is False


def test_taiwan_palestine_kosovo_not_inherited(overrides, policy):
    assert resolve_token("TWN", overrides).iso3 == "TWN"
    assert resolve_token("PSE", overrides).iso3 == "PSE"
    assert resolve_token("XKX", overrides).iso3 == "XKX"
    assert may_inherit_mu("CHN", "TWN", policy) is False
    assert may_inherit_mu("ISR", "PSE", policy) is False
    assert may_inherit_mu("SRB", "XKX", policy) is False


def test_policy_file_validates():
    loaded = load_territory_policy()
    assert loaded.version == 1
    assert loaded.geometry_viewpoint == "natural_earth_de_facto"
    assert loaded.inherit_mu_to_disputed is False
