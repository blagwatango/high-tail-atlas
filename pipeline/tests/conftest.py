from __future__ import annotations

import pytest

from hightail.normalize import (
    Iso3Overrides,
    TerritoryPolicy,
    load_iso3_overrides,
    load_territory_policy,
)


@pytest.fixture(scope="session")
def overrides() -> Iso3Overrides:
    return load_iso3_overrides()


@pytest.fixture(scope="session")
def policy() -> TerritoryPolicy:
    return load_territory_policy()
