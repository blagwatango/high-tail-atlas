from __future__ import annotations

import sys
from pathlib import Path

import pytest
from scipy.stats import norm

_SRC = Path(__file__).resolve().parents[1] / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from hightail.tails import (  # noqa: E402
    DEFAULT_SIGMA,
    PM3_DELTA,
    SE_Z,
    THRESHOLD_IQ,
    compute_tails,
    tail_p,
)

# scipy.stats.norm.sf(2) locked as the product golden.
GOLDEN_SF2 = 0.022750131948179195
ABS_TOL = 1e-12

# expected_atlas_min.json USA row (μ=100, σ=15, δ=3).
FIXTURE_P_LO_PM3 = 0.01390344751349861
FIXTURE_P_HI_PM3 = 0.03593031911292581


@pytest.mark.parametrize("z", [2.0, 3.0, 4.0])
def test_tail_p_matches_scipy_sf_at_z(z: float) -> None:
    mu = THRESHOLD_IQ - DEFAULT_SIGMA * z
    assert tail_p(mu, DEFAULT_SIGMA) == pytest.approx(float(norm.sf(z)), abs=ABS_TOL)


def test_mu100_sigma15_matches_sf2_golden() -> None:
    p = tail_p(100, 15)
    assert p == pytest.approx(GOLDEN_SF2, abs=ABS_TOL)
    assert p == pytest.approx(float(norm.sf(2)), abs=ABS_TOL)


def test_far_tail_z4_is_mu70() -> None:
    # Worked example: μ=70, σ=15 → z=4. Far tail is where a bad sf fails.
    p = tail_p(70, 15)
    assert p == pytest.approx(float(norm.sf(4)), abs=ABS_TOL)
    assert p == pytest.approx(3.167124183311998e-05, abs=ABS_TOL)


def test_compute_tails_always_stores_pm3_when_p_hat_non_null() -> None:
    fields = compute_tails(100, 15)
    assert fields["p_hat"] is not None
    assert fields["p_lo_pm3"] is not None
    assert fields["p_hi_pm3"] is not None
    assert fields["p_lo_se"] is None
    assert fields["p_hi_se"] is None
    assert fields["p_lo_pm3"] < fields["p_hat"] < fields["p_hi_pm3"]


def test_pm3_bands_are_delta_3_about_mu() -> None:
    fields = compute_tails(100, 15)
    assert fields["p_lo_pm3"] == pytest.approx(
        tail_p(100 - PM3_DELTA, 15), abs=ABS_TOL
    )
    assert fields["p_hi_pm3"] == pytest.approx(
        tail_p(100 + PM3_DELTA, 15), abs=ABS_TOL
    )
    assert fields["p_lo_pm3"] == pytest.approx(float(norm.sf(2.2)), abs=ABS_TOL)
    assert fields["p_hi_pm3"] == pytest.approx(float(norm.sf(1.8)), abs=ABS_TOL)
    assert fields["p_lo_pm3"] == pytest.approx(FIXTURE_P_LO_PM3, abs=ABS_TOL)
    assert fields["p_hi_pm3"] == pytest.approx(FIXTURE_P_HI_PM3, abs=ABS_TOL)


def test_se_bands_use_1_96_mu_se() -> None:
    mu_se = 1.5
    fields = compute_tails(100, 15, mu_se=mu_se)
    half = SE_Z * mu_se
    assert fields["p_lo_se"] == pytest.approx(tail_p(100 - half, 15), abs=ABS_TOL)
    assert fields["p_hi_se"] == pytest.approx(tail_p(100 + half, 15), abs=ABS_TOL)
    assert fields["p_lo_pm3"] is not None
    assert fields["p_hi_pm3"] is not None


def test_null_mu_yields_all_null_tails() -> None:
    assert compute_tails(None) == {
        "p_hat": None,
        "p_lo_pm3": None,
        "p_hi_pm3": None,
        "p_lo_se": None,
        "p_hi_se": None,
    }


def test_default_sigma_is_15() -> None:
    assert tail_p(100) == pytest.approx(tail_p(100, 15), abs=ABS_TOL)
    assert compute_tails(100)["p_hat"] == pytest.approx(GOLDEN_SF2, abs=ABS_TOL)


def test_sigma_must_be_positive() -> None:
    with pytest.raises(ValueError, match="sigma must be positive"):
        tail_p(100, 0)
