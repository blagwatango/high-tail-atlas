/** Public JSON lives under `web/public/data/`, not a TS import. */

export function publicDataPath(file = "atlas.json"): string {
  const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";
  const base = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  return `${base}/data/${file}`;
}

/**
 * Runtime URL for the published artifact. Never `fetch("/data/atlas.json")`
 * — that ignores `NEXT_PUBLIC_BASE_PATH` on project-pages deploys.
 */
export function atlasHref(): string {
  const prefix = process.env.NEXT_PUBLIC_BASE_PATH || "";
  if (typeof window === "undefined") {
    return publicDataPath();
  }
  const origin = window.location.origin;
  const withSlash = prefix.endsWith("/") ? prefix : `${prefix}/`;
  return new URL("data/atlas.json", `${origin}${withSlash}`).toString();
}
