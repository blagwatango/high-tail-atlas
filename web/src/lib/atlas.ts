/**
 * Resolve the static atlas.json URL, honoring NEXT_PUBLIC_BASE_PATH.
 * Public files are a URL tree, not a TS module — never import from public/.
 */
export function atlasHrefFrom(origin: string, basePath: string): string {
  const prefix = basePath || "";
  return new URL(
    "data/atlas.json",
    `${origin}${prefix.endsWith("/") ? prefix : prefix + "/"}`,
  ).toString();
}

/** Browser-only. Call from a client island, not during RSC render. */
export function atlasHref(): string {
  return atlasHrefFrom(
    window.location.origin,
    process.env.NEXT_PUBLIC_BASE_PATH || "",
  );
}
