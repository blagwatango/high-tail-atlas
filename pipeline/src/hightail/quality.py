"""Sample-quality assignment for estimate rows.

``assign_quality`` may only **downgrade** a source-provided flag, never
upgrade it. When the source omits ``quality``, the sample_type mapping
below is used.

U ≡ C for later filters (inclusion and hatch). E is ingest/error and is
never included by an A/B/C/D threshold.
"""

from __future__ import annotations

from typing import Literal

Quality = Literal["A", "B", "C", "D", "E", "U"]
SampleType = Literal[
    "adult_representative",
    "students",
    "children",
    "urban",
    "clinical",
    "convenience",
    "imputed",
    "unknown",
]

SAMPLE_TYPES: frozenset[str] = frozenset(
    {
        "adult_representative",
        "students",
        "children",
        "urban",
        "clinical",
        "convenience",
        "imputed",
        "unknown",
    }
)
QUALITIES: frozenset[str] = frozenset({"A", "B", "C", "D", "E", "U"})

# Lower is better. U shares C's rank so threshold C includes U.
_RANK: dict[str, int] = {
    "A": 0,
    "B": 1,
    "C": 2,
    "U": 2,
    "D": 3,
    "E": 4,
}

_THRESHOLDS: tuple[str, ...] = ("A", "B", "C", "D")


def _named_source(source: str | None) -> bool:
    return bool(source and source.strip())


def _infer_quality(
    sample_type: str | None,
    sample_n: int | None,
    source_year: int | None,
    source: str | None,
) -> str:
    st = "unknown" if sample_type is None else sample_type
    if st not in SAMPLE_TYPES:
        raise ValueError(f"invalid sample_type: {sample_type!r}")
    if st == "unknown":
        return "U"
    if st == "imputed":
        return "D"
    if st in {"children", "clinical", "convenience"}:
        return "C"
    n = 0 if sample_n is None else sample_n
    if st in {"students", "urban"}:
        return "B" if n >= 300 else "C"
    if st != "adult_representative":
        raise ValueError(f"invalid sample_type: {sample_type!r}")
    if n >= 1000 and source_year is not None and _named_source(source):
        return "A"
    if n >= 300:
        return "B"
    return "C"


def _worse(source_quality: str, inferred: str) -> str:
    """Return the lower-quality flag; on a tie, keep the source flag."""
    if _RANK[inferred] > _RANK[source_quality]:
        return inferred
    return source_quality


def assign_quality(
    *,
    source_quality: str | None = None,
    sample_type: str | None = None,
    sample_n: int | None = None,
    source_year: int | None = None,
    source: str | None = None,
) -> str:
    """Assign a quality code from source metadata.

    Default mapping when ``source_quality`` is omitted:

    - adult_representative n>=1000 (and year + named source) → A
    - adult_representative n<1000 → B if n>=300 else C
    - students or urban n>=300 → B (else C)
    - children, clinical, convenience → C
    - imputed → D
    - unknown / missing sample_type → U
    """
    if source_quality is not None and source_quality not in QUALITIES:
        raise ValueError(f"invalid quality: {source_quality!r}")
    inferred = _infer_quality(sample_type, sample_n, source_year, source)
    if source_quality is None:
        return inferred
    return _worse(source_quality, inferred)


def included_at_threshold(quality: str | None, threshold: str) -> bool:
    """Inclusive A≻B≻C≻D ceiling. U ≡ C; E and null are never included."""
    if threshold not in _THRESHOLDS:
        raise ValueError(f"threshold must be A, B, C, or D, got {threshold!r}")
    if quality is None or quality == "E":
        return False
    if quality not in QUALITIES:
        raise ValueError(f"invalid quality: {quality!r}")
    mapped = "C" if quality == "U" else quality
    return _THRESHOLDS.index(mapped) <= _THRESHOLDS.index(threshold)
