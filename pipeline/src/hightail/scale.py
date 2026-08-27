"""Metric scales for the tail formula.

IQ (historical tests) keeps T=130, σ=15. PISA 2022 mathematics uses the
OECD scale (origin mean 500, SD 100) with tail threshold 700 (+2 SD).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ScaleConfig:
    name: str
    threshold: float
    default_sigma: float
    pm3_delta: float
    mu_min: float
    mu_max: float
    sigma_min: float
    sigma_max: float
    sigma_flag_lo: float
    sigma_flag_hi: float
    sigma_flag_label: str
    assumed_sigma_source: str
    formula: str
    metric_label: str
    dataset_id: str
    assumptions: tuple[str, ...]
    caveat_text: str


IQ_SCALE = ScaleConfig(
    name="iq",
    threshold=130.0,
    default_sigma=15.0,
    pm3_delta=3.0,
    mu_min=50.0,
    mu_max=130.0,
    sigma_min=5.0,
    sigma_max=30.0,
    sigma_flag_lo=12.0,
    sigma_flag_hi=20.0,
    sigma_flag_label="outside_12_20",
    assumed_sigma_source="assumed_15",
    formula="p = 1 - Phi((130 - mu) / sigma)",
    metric_label="Estimated share modeled at IQ ≥ 130",
    dataset_id="demo-quality-c",
    assumptions=(
        "IQ in each country is i.i.d. N(mu_i, sigma_i^2). Real distributions are discrete, bounded, and often skewed; the far tail is the part of a normal that is least credible.",
        "Tests, if any, are interval-scaled on the same metric as IQ points.",
        "mu_i is an unbiased estimate of the current national resident mean. Most sources fail this (children, convenience, old tests, Flynn drift, urban samples).",
        "sigma_i = 15 unless published. Between-country variance of SDs is ignored. If true sigma_i > 15, p_hat is understated for mu_i < 130; if sigma_i < 15, overstated.",
        "Independence from age structure. Applying p_hat to total population (including infants) is a modeling convenience, not a claim that toddlers have IQ scores. v1 does not age-standardize.",
        "No correction for restriction of range, test ceiling, or Flynn effect inside this pipeline. If the source already adjusted, that belongs in provenance, not a second adjustment.",
    ),
    caveat_text=(
        "These figures are modeled estimates, not measurements. "
        "Each percentage is the right tail of a normal distribution given a "
        "published or assumed country mean and SD (default 15), applied to UN "
        "population counts. National IQ compilations are incomplete and contested. "
        "This is not a ranking of people, nations, or worth."
    ),
)

PISA_SCALE = ScaleConfig(
    name="pisa",
    threshold=700.0,
    default_sigma=100.0,
    pm3_delta=20.0,
    mu_min=200.0,
    mu_max=800.0,
    sigma_min=40.0,
    sigma_max=150.0,
    sigma_flag_lo=70.0,
    sigma_flag_hi=130.0,
    sigma_flag_label="outside_12_20",
    assumed_sigma_source="assumed_100",
    formula="p = 1 - Phi((700 - mu) / sigma)",
    metric_label=(
        "Estimated share of 15-year-olds modeled at PISA mathematics ≥ 700"
    ),
    dataset_id="pisa-2022-math",
    assumptions=(
        "PISA mathematics scores among sampled 15-year-olds in school are modeled as i.i.d. N(mu_i, sigma_i^2). Real score distributions are discrete and bounded; the far tail is the least credible part of a normal.",
        "The OECD PISA scale was set so the initial OECD mean is 500 and SD is 100. 700 is +2 SD on that scale. It is scholastic achievement, not IQ.",
        "mu_i is the published 2022 country mean for 15-year-olds in school, not the adult resident population.",
        "sigma_i = 100 unless a country SD is published. Between-country SD differences are ignored.",
        "Applying p_hat to UN total population (including infants) is only order-of-magnitude context, not a count of 15-year-olds or of people who sat PISA.",
        "Countries that did not publish a 2022 PISA mathematics mean stay blank. Missing means are never filled from neighbors.",
    ),
    caveat_text=(
        "These figures are modeled estimates, not measurements. "
        "Each percentage is the right tail of a normal distribution given a "
        "published PISA 2022 mathematics country mean and SD (default 100), "
        "for 15-year-olds in school. This is scholastic achievement, not IQ. "
        "This is not a ranking of people, nations, or worth."
    ),
)

SCALES: dict[str, ScaleConfig] = {"iq": IQ_SCALE, "pisa": PISA_SCALE}


def get_scale(name: str | ScaleConfig | None) -> ScaleConfig:
    if name is None:
        return IQ_SCALE
    if isinstance(name, ScaleConfig):
        return name
    key = name.strip().lower()
    if key not in SCALES:
        raise ValueError(f"unknown scale {name!r}; expected iq or pisa")
    return SCALES[key]
