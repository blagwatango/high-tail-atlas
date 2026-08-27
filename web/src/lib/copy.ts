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

export const HOME_INTRO =
  "Modeled estimates of the share of 15-year-olds at PISA mathematics ≥ 700. Country means are OECD PISA 2022 mathematics scores; figures are model output, not IQ and not a census.";

export const THIN_TAIL_NOTE =
  "PISA 700 is +2 SD on the OECD origin scale (mean 500, SD 100). At that origin the modeled tail is about 2.28% — a thin slice of a normal, and smaller where a country’s mean is lower. Most of the map is blank because those countries have no published 2022 PISA mean, not because the tail is zero. If a claim required only people above +2 SD, the modeled share is that sliver. This is school mathematics among 15-year-olds, not a map of who can use AI.";

export const MAP_NOTE =
  "+2 SD is a thin slice of a normal (about 2.28% at μ=500, σ=100). Hatched gray is no published 2022 mean, not a zero tail. Keyboard path:";

export const MAP_HINT_COMPACT =
  "Tap a country for the modeled share. One finger still scrolls the page; pinch is off so the map cannot trap the screen.";

export const MAP_HINT_DESKTOP =
  "Drag to pan, wheel to zoom. Click a country for the modeled share.";

export const CAVEAT_BANNER =
  "These figures are modeled estimates, not measurements. Each percentage is the right tail of a normal distribution given a published PISA 2022 mathematics country mean and SD (default 100), for 15-year-olds in school. This is scholastic achievement, not IQ. This is not a ranking of people, nations, or worth, and not a map of who can use AI.";
