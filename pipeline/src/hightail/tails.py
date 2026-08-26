"""Normal right-tail P(IQ >= T) and sensitivity / SE bands.

Python publishes p_hat via scipy.stats.norm.sf. Always store p_lo_pm3 /
p_hi_pm3 when p_hat is non-null. The ±3 band is illustrative (~0.2σ if
σ=15), not a confidence interval.
"""

from __future__ import annotations

from typing import TypedDict

from scipy.stats import norm

THRESHOLD_IQ = 130
DEFAULT_SIGMA = 15.0
PM3_DELTA = 3.0
SE_Z = 1.96


class TailFields(TypedDict):
    p_hat: float | None
    p_lo_pm3: float | None
    p_hi_pm3: float | None
    p_lo_se: float | None
    p_hi_se: float | None


_NULL_TAILS: TailFields = {
    "p_hat": None,
    "p_lo_pm3": None,
    "p_hi_pm3": None,
    "p_lo_se": None,
    "p_hi_se": None,
}


def tail_p(
    mu: float,
    sigma: float = DEFAULT_SIGMA,
    threshold: float = THRESHOLD_IQ,
) -> float:
    """P(X >= threshold) for X ~ N(mu, sigma^2)."""
    if sigma <= 0:
        raise ValueError("sigma must be positive")
    return float(norm.sf((threshold - mu) / sigma))


def compute_tails(
    mu: float | None,
    sigma: float | None = DEFAULT_SIGMA,
    mu_se: float | None = None,
    *,
    threshold: float = THRESHOLD_IQ,
    delta: float = PM3_DELTA,
) -> TailFields:
    """Point tail plus pm3 bands; SE bands only when mu_se is provided."""
    if mu is None:
        return dict(_NULL_TAILS)

    sig = DEFAULT_SIGMA if sigma is None else sigma
    p_hat = tail_p(mu, sig, threshold)
    p_lo_pm3 = tail_p(mu - delta, sig, threshold)
    p_hi_pm3 = tail_p(mu + delta, sig, threshold)

    p_lo_se: float | None = None
    p_hi_se: float | None = None
    if mu_se is not None:
        half = SE_Z * mu_se
        p_lo_se = tail_p(mu - half, sig, threshold)
        p_hi_se = tail_p(mu + half, sig, threshold)

    return {
        "p_hat": p_hat,
        "p_lo_pm3": p_lo_pm3,
        "p_hi_pm3": p_hi_pm3,
        "p_lo_se": p_lo_se,
        "p_hi_se": p_hi_se,
    }
