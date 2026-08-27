"""Command-line interface for the High-Tail Atlas pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from hightail.adapters import AdapterError, load_becker, load_pisa, write_estimates_csv
from hightail.emit import EmitError, build_atlas
from hightail.scale import SCALES
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
        "--scale",
        choices=tuple(SCALES),
        default="iq",
        help="Metric scale: iq (T=130, σ=15) or pisa (T=700, σ=100)",
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
        "--scale",
        choices=tuple(SCALES),
        default="iq",
        help="Metric scale: iq (T=130, σ=15) or pisa (T=700, σ=100)",
    )
    build_parser.add_argument(
        "--geometry-index",
        default=None,
        help="Natural Earth 110m TopoJSON (default: web/public/data/world-110m.topo.json)",
    )
    build_parser.add_argument(
        "--parquet",
        default=None,
        help="Optional Parquet output (not written in this version)",
    )

    adapter_parser = subparsers.add_parser(
        "adapter",
        help="Post-v1 source adapters (legal-review gate; not v1 default data).",
    )
    adapter_sub = adapter_parser.add_subparsers(dest="adapter_name", required=True)

    def _add_adapter_args(p: argparse.ArgumentParser) -> None:
        p.add_argument(
            "--source",
            required=True,
            help="Local uncommitted source file (never a URL)",
        )
        p.add_argument(
            "--license-ok",
            action="store_true",
            help="Explicit license-review flag (or set HIGHTAIL_ADAPTER_LICENSE_OK=1)",
        )
        p.add_argument(
            "--out",
            default=None,
            help="Optional estimates CSV path (do not commit contested tables)",
        )

    _add_adapter_args(
        adapter_sub.add_parser(
            "becker",
            help="Becker NIQ adapter (blocked without license gate)",
        )
    )
    _add_adapter_args(
        adapter_sub.add_parser(
            "pisa",
            help="PISA adapter (relabels metric; not IQ)",
        )
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
            scale=args.scale,
        )
    except IngestError as exc:
        print(f"ingest error: {exc}", file=sys.stderr)
        return 1
    _print_ingest_report(result)
    return 0


def _cmd_build(args: argparse.Namespace) -> int:
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
            geometry_path=args.geometry_index,
            scale=args.scale,
        )
    except (IngestError, EmitError) as exc:
        print(f"build error: {exc}", file=sys.stderr)
        return 1
    manifest = atlas["manifest"]
    print(f"wrote: {args.out}")
    print(f"ok: {manifest['n_ok']}")
    print(f"no_estimate: {manifest['n_no_estimate']}")
    print(f"no_iso: {manifest['n_no_iso']}")
    print(f"unmatched: {manifest['n_unmatched']}")
    return 0


def _cmd_adapter(args: argparse.Namespace) -> int:
    loader = load_becker if args.adapter_name == "becker" else load_pisa
    try:
        result = loader(args.source, license_ok=args.license_ok)
    except AdapterError as exc:
        print(f"adapter error: {exc}", file=sys.stderr)
        return 1
    print(f"adapter: {args.adapter_name}")
    print(f"rows: {len(result.rows)}")
    print(f"imputed: {result.n_imputed}")
    print(f"metric_label: {result.metric_label}")
    if args.out:
        write_estimates_csv(result, Path(args.out))
        print(f"wrote: {args.out}")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    if args.command == "ingest":
        return _cmd_ingest(args)
    if args.command == "build":
        return _cmd_build(args)
    if args.command == "adapter":
        return _cmd_adapter(args)
    parser.error(f"unknown command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
