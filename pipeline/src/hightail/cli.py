"""Command-line interface for the High-Tail Atlas pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from hightail.emit import EmitError, build_atlas
from hightail.ingest import (
    ON_DUPLICATE_CHOICES,
    IngestError,
    IngestResult,
    ingest_estimates,
)
from hightail.normalize import load_iso3_overrides
from hightail.wpp import DEFAULT_REFERENCE_YEAR


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="hightail",
        description="High-Tail Atlas build-time pipeline.",
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    ingest_parser = subparsers.add_parser(
        "ingest",
        help="Validate an estimates CSV and print row counts (no atlas.json emit).",
    )
    ingest_parser.add_argument(
        "--estimates",
        required=True,
        help="UTF-8 estimates CSV path",
    )
    ingest_parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and report counts without writing atlas.json",
    )
    ingest_parser.add_argument(
        "--allow-extreme-mu",
        action="store_true",
        help="Keep rows with mu outside (50, 130) and flag quality E",
    )
    ingest_parser.add_argument(
        "--on-duplicate",
        choices=ON_DUPLICATE_CHOICES,
        default="error",
        help="How to handle duplicate ISO-3 rows (default: error)",
    )
    ingest_parser.add_argument(
        "--overrides",
        default=None,
        help="Optional iso3_overrides.yaml path",
    )
    ingest_parser.add_argument(
        "--schema",
        default=None,
        help="Optional estimates.schema.json path",
    )

    build_parser = subparsers.add_parser(
        "build",
        help="Join estimates to WPP, compute tails, and write atlas.json.",
    )
    build_parser.add_argument("--estimates", required=True, help="UTF-8 estimates CSV path")
    build_parser.add_argument(
        "--population",
        required=True,
        help="WPP extract CSV (persons, not thousands)",
    )
    build_parser.add_argument(
        "--out",
        required=True,
        help="Output atlas.json path (web/public/data/atlas.json)",
    )
    build_parser.add_argument(
        "--overrides",
        default=None,
        help="iso3_overrides.yaml path",
    )
    build_parser.add_argument(
        "--policy",
        default=None,
        help="territory_policy.yaml path",
    )
    build_parser.add_argument(
        "--schema",
        default=None,
        help="Optional estimates.schema.json path",
    )
    build_parser.add_argument(
        "--atlas-schema",
        default=None,
        help="Optional atlas.schema.json path",
    )
    build_parser.add_argument(
        "--reference-year",
        type=int,
        default=DEFAULT_REFERENCE_YEAR,
        help="WPP reference year (default: 2025)",
    )
    build_parser.add_argument(
        "--allow-unmatched",
        action="store_true",
        help="Emit unmatched estimates instead of failing the build",
    )
    build_parser.add_argument(
        "--allow-extreme-mu",
        action="store_true",
        help="Keep rows with mu outside (50, 130) and flag quality E",
    )
    build_parser.add_argument(
        "--on-duplicate",
        choices=ON_DUPLICATE_CHOICES,
        default="error",
        help="How to handle duplicate ISO-3 rows (default: error)",
    )
    build_parser.add_argument(
        "--geometry-index",
        default=None,
        help="Optional Natural Earth ISO-3 index (ignored until geometry join)",
    )
    build_parser.add_argument(
        "--parquet",
        default=None,
        help="Optional Parquet output (not written in this version)",
    )
    return parser


def _print_ingest_report(result: IngestResult) -> None:
    print(f"read: {result.n_read}")
    print(f"ok: {result.n_ok}")
    print(f"unmatched: {result.n_unmatched}")
    if result.unmatched:
        print("unmatched_names:")
        for row in result.unmatched:
            label = row.raw_name or row.raw_iso3 or "(anonymous)"
            print(f"  {label} ({row.reason})")


def _cmd_ingest(args: argparse.Namespace) -> int:
    overrides = (
        load_iso3_overrides(args.overrides) if args.overrides is not None else None
    )
    try:
        result = ingest_estimates(
            Path(args.estimates),
            overrides=overrides,
            allow_extreme_mu=args.allow_extreme_mu,
            on_duplicate=args.on_duplicate,
            schema_path=args.schema,
        )
    except IngestError as exc:
        print(f"ingest error: {exc}", file=sys.stderr)
        return 1
    _print_ingest_report(result)
    return 0


def _cmd_build(args: argparse.Namespace) -> int:
    if args.geometry_index:
        print("build: --geometry-index ignored (has_geometry=false)", file=sys.stderr)
    if args.parquet:
        print("build: --parquet ignored (not emitted in this version)", file=sys.stderr)
    try:
        atlas = build_atlas(
            args.estimates,
            args.population,
            args.out,
            overrides_path=args.overrides,
            policy_path=args.policy,
            estimates_schema=args.schema,
            atlas_schema=args.atlas_schema,
            reference_year=args.reference_year,
            allow_unmatched=args.allow_unmatched,
            allow_extreme_mu=args.allow_extreme_mu,
            on_duplicate=args.on_duplicate,
        )
    except (IngestError, EmitError) as exc:
        print(f"build error: {exc}", file=sys.stderr)
        return 1
    manifest = atlas["manifest"]
    print(f"wrote: {args.out}")
    print(f"ok: {manifest['n_ok']}")
    print(f"no_estimate: {manifest['n_no_estimate']}")
    print(f"unmatched: {manifest['n_unmatched']}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if args.command == "ingest":
        return _cmd_ingest(args)
    if args.command == "build":
        return _cmd_build(args)
    parser.error(f"unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
