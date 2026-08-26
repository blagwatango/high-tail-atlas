import pytest

from hightail.quality import assign_quality, included_at_threshold


NAMED = dict(source_year=2020, source="National sample")


@pytest.mark.parametrize(
    "kwargs, expected",
    [
        (
            dict(
                sample_type="adult_representative",
                sample_n=1000,
                **NAMED,
            ),
            "A",
        ),
        (
            dict(sample_type="adult_representative", sample_n=999, **NAMED),
            "B",
        ),
        (
            dict(sample_type="adult_representative", sample_n=300, **NAMED),
            "B",
        ),
        (
            dict(sample_type="adult_representative", sample_n=299, **NAMED),
            "C",
        ),
        (dict(sample_type="adult_representative", sample_n=1000), "B"),
        (
            dict(
                sample_type="adult_representative",
                sample_n=1000,
                source_year=2020,
            ),
            "B",
        ),
        (dict(sample_type="adult_representative"), "C"),
        (dict(sample_type="students", sample_n=300), "B"),
        (dict(sample_type="students", sample_n=299), "C"),
        (dict(sample_type="urban", sample_n=1000), "B"),
        (dict(sample_type="urban"), "C"),
        (dict(sample_type="children", sample_n=5000, **NAMED), "C"),
        (dict(sample_type="clinical", sample_n=5000), "C"),
        (dict(sample_type="convenience", sample_n=1), "C"),
        (dict(sample_type="imputed", sample_n=10_000, **NAMED), "D"),
        (dict(sample_type="unknown", sample_n=10_000, **NAMED), "U"),
        (dict(), "U"),
    ],
)
def test_default_mapping(kwargs, expected):
    assert assign_quality(**kwargs) == expected


@pytest.mark.parametrize(
    "source_quality, kwargs, expected",
    [
        ("A", dict(sample_type="convenience"), "C"),
        ("A", dict(sample_type="imputed"), "D"),
        ("A", dict(sample_type="unknown"), "U"),
        ("A", dict(sample_type="students", sample_n=400), "B"),
        (
            "A",
            dict(sample_type="adult_representative", sample_n=200, **NAMED),
            "C",
        ),
        (
            "A",
            dict(sample_type="adult_representative", sample_n=1000, **NAMED),
            "A",
        ),
        (
            "C",
            dict(sample_type="adult_representative", sample_n=5000, **NAMED),
            "C",
        ),
        (
            "B",
            dict(sample_type="adult_representative", sample_n=5000, **NAMED),
            "B",
        ),
        (
            "D",
            dict(sample_type="adult_representative", sample_n=5000, **NAMED),
            "D",
        ),
        ("E", dict(sample_type="adult_representative", sample_n=5000, **NAMED), "E"),
        ("U", dict(sample_type="convenience"), "U"),
        ("U", dict(sample_type="imputed"), "D"),
        ("C", dict(sample_type="unknown"), "C"),
        ("A", dict(), "U"),
    ],
)
def test_source_flag_is_never_upgraded(source_quality, kwargs, expected):
    assert assign_quality(source_quality=source_quality, **kwargs) == expected


def test_invalid_source_quality():
    with pytest.raises(ValueError, match="invalid quality"):
        assign_quality(source_quality="Z")


def test_invalid_sample_type():
    with pytest.raises(ValueError, match="invalid sample_type"):
        assign_quality(sample_type="national")


@pytest.mark.parametrize(
    "quality, threshold, included",
    [
        ("A", "A", True),
        ("B", "A", False),
        ("U", "A", False),
        ("A", "B", True),
        ("B", "B", True),
        ("C", "B", False),
        ("U", "B", False),
        ("A", "C", True),
        ("B", "C", True),
        ("C", "C", True),
        ("U", "C", True),
        ("D", "C", False),
        ("E", "C", False),
        (None, "C", False),
        ("D", "D", True),
        ("U", "D", True),
        ("E", "D", False),
        (None, "D", False),
        ("E", "A", False),
    ],
)
def test_u_equiv_c_for_filters(quality, threshold, included):
    assert included_at_threshold(quality, threshold) is included


def test_threshold_rejects_e_and_u():
    with pytest.raises(ValueError, match="threshold"):
        included_at_threshold("A", "E")
    with pytest.raises(ValueError, match="threshold"):
        included_at_threshold("A", "U")
