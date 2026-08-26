/**
 * Resolve a file under public/data/, honoring NEXT_PUBLIC_BASE_PATH.
 * Public files are a URL tree, not a TS module — never import from public/.
 */
export function publicDataHrefFrom(
  origin: string,
  basePath: string,
  fileName: string,
): string {
  const prefix = basePath || "";
  return new URL(
    `data/${fileName}`,
    `${origin}${prefix.endsWith("/") ? prefix : prefix + "/"}`,
  ).toString();
}

export function atlasHrefFrom(origin: string, basePath: string): string {
  return publicDataHrefFrom(origin, basePath, "atlas.json");
}

export function worldTopoHrefFrom(origin: string, basePath: string): string {
  return publicDataHrefFrom(origin, basePath, "world-110m.topo.json");
}

/** Browser-only. Call from a client island, not during RSC render. */
export function atlasHref(): string {
  return atlasHrefFrom(
    window.location.origin,
    process.env.NEXT_PUBLIC_BASE_PATH || "",
  );
}

/** Browser-only Natural Earth TopoJSON URL. */
export function worldTopoHref(): string {
  return worldTopoHrefFrom(
    window.location.origin,
    process.env.NEXT_PUBLIC_BASE_PATH || "",
  );
}
