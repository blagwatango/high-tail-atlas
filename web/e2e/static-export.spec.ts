import { existsSync, statSync } from "fs";
import { join } from "path";
import { expect, test } from "@playwright/test";

const outDir = join(__dirname, "..", "out");
const ATLAS_MAX = 250 * 1024;

function prefixPath(path: string): string {
  const prefix = (process.env.PLAYWRIGHT_BASE_PATH || "").replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${p}`;
}

function atlasOnDisk(): string {
  const flat = join(outDir, "data", "atlas.json");
  const nested = join(outDir, "high-tail-atlas", "data", "atlas.json");
  if (existsSync(flat)) return flat;
  return nested;
}

test("out/data/atlas.json exists on disk under the size budget", () => {
  const atlas = atlasOnDisk();
  expect(existsSync(atlas), "out/data/atlas.json missing — run pnpm build").toBe(
    true,
  );
  const n = statSync(atlas).size;
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(ATLAS_MAX);
});

test("GET atlas.json returns 200 from the static export", async ({
  request,
}) => {
  const res = await request.get(prefixPath("/data/atlas.json"));
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("manifest");
  expect(body).toHaveProperty("countries");
});

test("demo robots.txt Disallows /", async ({ request }) => {
  const res = await request.get(prefixPath("/robots.txt"));
  expect(res.status()).toBe(200);
  const text = await res.text();
  expect(text).toMatch(/User-agent:\s*\*/i);
  expect(text).toMatch(/Disallow:\s*\//);
});

test("export HTML honors NEXT_PUBLIC_BASE_PATH", async ({ request }) => {
  const prefix = (process.env.PLAYWRIGHT_BASE_PATH || "").replace(/\/$/, "");
  const home = await request.get(prefixPath("/"));
  expect(home.status()).toBe(200);
  const html = await home.text();
  if (prefix) {
    expect(html).toContain(`${prefix}/`);
  } else {
    expect(html).not.toContain("/high-tail-atlas/");
  }
});
