"""Download pinned WPP 2024 Compact CSV and write data/raw/wpp_extract.csv.

DESA PopTotal is thousands of persons; the extract stores
round(PopTotal * 1000) persons. Aggregates with a blank ISO-3 are skipped.

If DESA is unreachable, Our World in Data's processed WPP file is an allowed
fallback. Citation remains UN DESA 2024 either way.
"""

from __future__ import annotations

import argparse
import csv
import io
import sys
import urllib.error
import urllib.request
from pathlib import Path

_PIPELINE_ROOT = Path(__file__).resolve().parents[1]
_SRC = _PIPELINE_ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from hightail.wpp import (  # noqa: E402
    DEFAULT_REFERENCE_YEAR,
    MEDIUM_VARIANT,
    WppError,
    extract_row_from_compact,
    parse_pin_sha256,
    sha256_file,
    write_wpp_extract,
)

_REPO_ROOT = _PIPELINE_ROOT.parent
_DEFAULT_OUT = _REPO_ROOT / "data" / "raw" / "wpp_extract.csv"
_DEFAULT_PIN = _REPO_ROOT / "data" / "raw" / "WPP_PIN.txt"

DESA_URLS = (
    "https://population.un.org/wpp/assets/CSV/WPP2024_Demographic_Indicators_Compact.csv",
    "https://population.un.org/wpp/Download/Files/1_Indicators%20(Standard)/CSV_FILES/WPP2024_Demographic_Indicators_Compact.csv",
)
OWID_URLS = (
    "https://catalog.ourworldindata.org/garden/un/2024-07-11/un_wpp/un_wpp_population.csv",
    "https://ourworldindata.org/grapher/population.csv",
)

CITATION = (
    "United Nations, DESA/Population Division (2024). "
    "World Population Prospects 2024."
)
SOURCE_PAGE = "https://population.un.org/wpp/assets/"
USER_AGENT = "High-Tail-Atlas/0.0 (WPP extract; research pipeline)"


def _download(url: str, timeout: int = 60) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def _parse_compact(text: str, *, pop_in_thousands: bool, reference_year: int):
    handle = io.StringIO(text)
    reader = csv.DictReader(handle)
    if not reader.fieldnames:
        raise WppError("downloaded CSV has no header")
    rows = {}
    for raw in reader:
        parsed = extract_row_from_compact(
            raw, reference_year=reference_year, pop_in_thousands=pop_in_thousands
        )
        if parsed is None:
            continue
        rows[parsed.iso3] = parsed
    if not rows:
        raise WppError("no ISO-3 Medium-variant rows for the reference year")
    return rows


def _write_pin(
    pin_path: Path,
    *,
    sha256: str,
    filename: str,
    source_url: str,
    notes: str,
    reference_year: int,
) -> None:
    pin_path.parent.mkdir(parents=True, exist_ok=True)
    pin_path.write_text(
        (
            "# High-Tail Atlas WPP extract pin\n"
            f"citation: {CITATION}\n"
            f"source_page: {SOURCE_PAGE}\n"
            f"source_url: {source_url}\n"
            f"filename: {filename}\n"
            f"reference_year: {reference_year}\n"
            f"variant: {MEDIUM_VARIANT}\n"
            f"sha256: {sha256}\n"
            f"notes: {notes}\n"
        ),
        encoding="utf-8",
        newline="\n",
    )


def fetch_and_write(
    out: Path,
    pin: Path,
    *,
    compact_path: Path | None = None,
    reference_year: int = DEFAULT_REFERENCE_YEAR,
    timeout: int = 60,
) -> int:
    source_url = "local"
    pop_in_thousands = True
    notes = (
        "Population is persons (round(PopTotal * 1000) from DESA compact). "
        "Not a national-IQ table."
    )

    if compact_path is not None:
        text = compact_path.read_text(encoding="utf-8-sig")
        source_url = str(compact_path)
        rows = _parse_compact(
            text, pop_in_thousands=True, reference_year=reference_year
        )
    else:
        text = None
        last_error: Exception | None = None
        for url in DESA_URLS:
            try:
                payload = _download(url, timeout=timeout)
                text = payload.decode("utf-8-sig")
                source_url = url
                pop_in_thousands = True
                notes = (
                    "Extracted from UN DESA WPP 2024 Demographic Indicators Compact. "
                    "PopTotal thousands → persons via round(PopTotal * 1000)."
                )
                break
            except (urllib.error.URLError, TimeoutError, UnicodeDecodeError, OSError) as exc:
                last_error = exc
        if text is None:
            for url in OWID_URLS:
                try:
                    payload = _download(url, timeout=timeout)
                    text = payload.decode("utf-8-sig")
                    source_url = url
                    pop_in_thousands = False
                    notes = (
                        "DESA Compact unreachable; fallback is Our World in Data "
                        "processed WPP 2024 (persons). Citation is still UN DESA 2024."
                    )
                    break
                except (
                    urllib.error.URLError,
                    TimeoutError,
                    UnicodeDecodeError,
                    OSError,
                ) as exc:
                    last_error = exc
        if text is None:
            print(
                "fetch_wpp: DESA and OWID downloads failed "
                f"({last_error}). Use the committed data/raw/wpp_extract.csv fixture.",
                file=sys.stderr,
            )
            return 1
        rows = _parse_compact(
            text, pop_in_thousands=pop_in_thousands, reference_year=reference_year
        )

    write_wpp_extract(rows.values(), out)
    digest = sha256_file(out)
    _write_pin(
        pin,
        sha256=digest,
        filename=out.name,
        source_url=source_url,
        notes=notes,
        reference_year=reference_year,
    )
    print(f"wrote {out} ({len(rows)} ISO-3 rows)")
    print(f"sha256 {digest}")
    return 0


def verify_pin(extract: Path, pin: Path) -> int:
    expected = parse_pin_sha256(pin)
    if expected is None:
        print(f"no sha256 in {pin}", file=sys.stderr)
        return 1
    actual = sha256_file(extract)
    if actual != expected:
        print(f"hash mismatch: pin={expected} file={actual}", file=sys.stderr)
        return 1
    print(f"ok {extract} sha256 {actual}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(_DEFAULT_OUT), help="wpp_extract.csv path")
    parser.add_argument("--pin", default=str(_DEFAULT_PIN), help="WPP_PIN.txt path")
    parser.add_argument(
        "--compact",
        default=None,
        help="Local DESA compact CSV (skip download)",
    )
    parser.add_argument("--reference-year", type=int, default=DEFAULT_REFERENCE_YEAR)
    parser.add_argument(
        "--verify",
        action="store_true",
        help="Check extract sha256 against WPP_PIN.txt and exit",
    )
    args = parser.parse_args(argv)
    out = Path(args.out)
    pin = Path(args.pin)
    if args.verify:
        return verify_pin(out, pin)
    compact = Path(args.compact) if args.compact else None
    try:
        return fetch_and_write(
            out,
            pin,
            compact_path=compact,
            reference_year=args.reference_year,
        )
    except WppError as exc:
        print(f"fetch_wpp: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
