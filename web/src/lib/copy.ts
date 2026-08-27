/** User-visible metric copy. Keep in sync with pipeline ScaleConfig PISA_SCALE. */

export const PISA_THRESHOLD = 700;
export const PISA_DEFAULT_SIGMA = 100;
export const PISA_DEFAULT_MU = 500;

export const METRIC_LABEL =
  "Estimated share of 15-year-olds modeled at PISA mathematics ≥ 700";

export const METRIC_LABEL_SHORT =
  "Estimated share modeled at PISA mathematics ≥ 700";

export const LOLLIPOP_AXIS =
  "Estimated % of 15-year-olds modeled at PISA mathematics ≥ 700";

export const MAP_CAPTION =
  "Modeled share of 15-year-olds at PISA mathematics ≥ 700 (normal tail). Bins are coarse on purpose.";

export const REFERENCE_TICK = "μ=500, σ=100 → 2.28%.";

export const CAVEAT_BANNER =
  "These figures are modeled estimates, not measurements. Each percentage is the right tail of a normal distribution given a published PISA 2022 mathematics country mean and SD (default 100), for 15-year-olds in school. This is scholastic achievement, not IQ. This is not a ranking of people, nations, or worth.";
