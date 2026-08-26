/**
 * Hard size budgets (design): atlas.json < 250 KB, TopoJSON 110m < 300 KB,
 * uncompressed. Optional committed JS gzip (including map) < 400 KB.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const ATLAS_MAX = 250 * 1024;
const TOPO_MAX = 300 * 1024;
const JS_GZIP_MAX = 400 * 1024;
const ATLAS_NAME = "atlas.json";
const TOPO_NAME = "world-110m.topo.json";

function kb(n) {
  return `${(n / 1024).toFixed(1)} KB`;
}

function walk(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function firstExisting(...paths) {
  return paths.find((p) => existsSync(p));
}

const outDir = join(WEB_ROOT, "out");
const nestedOut = join(outDir, "high-tail-atlas");
const dataRoots = [
  join(nestedOut, "data"),
  join(outDir, "data"),
  join(WEB_ROOT, "public", "data"),
];

const atlas = firstExisting(...dataRoots.map((d) => join(d, ATLAS_NAME)));
const topo = firstExisting(...dataRoots.map((d) => join(d, TOPO_NAME)));
const failures = [];

if (!atlas) {
  failures.push(`${ATLAS_NAME} missing (run pnpm pipeline && pnpm build)`);
} else {
  const n = statSync(atlas).size;
  const rel = relative(WEB_ROOT, atlas).replaceAll("\\", "/");
  if (n >= ATLAS_MAX) {
    failures.push(`${rel} is ${kb(n)} uncompressed; budget is ${kb(ATLAS_MAX)}`);
  } else {
    console.log(`${rel}: ${kb(n)} uncompressed (budget ${kb(ATLAS_MAX)})`);
  }
}

if (!topo) {
  failures.push(`${TOPO_NAME} missing`);
} else {
  const n = statSync(topo).size;
  const rel = relative(WEB_ROOT, topo).replaceAll("\\", "/");
  if (n >= TOPO_MAX) {
    failures.push(`${rel} is ${kb(n)} uncompressed; budget is ${kb(TOPO_MAX)}`);
  } else {
    console.log(`${rel}: ${kb(n)} uncompressed (budget ${kb(TOPO_MAX)})`);
  }
}

const exportRoot = existsSync(join(nestedOut, "index.html")) ? nestedOut : outDir;
const indexHtml = firstExisting(join(exportRoot, "index.html"));
const staticRoot = firstExisting(join(exportRoot, "_next", "static"));
const nojekyll = firstExisting(
  join(exportRoot, ".nojekyll"),
  join(outDir, ".nojekyll"),
  join(WEB_ROOT, "public", ".nojekyll"),
);

if (existsSync(outDir) && !nojekyll) {
  failures.push("out/.nojekyll missing (GitHub Pages would skip _next/)");
}

if (indexHtml && staticRoot) {
  const html = readFileSync(indexHtml, "utf8");
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
  const toFile = (src) => {
    const stripped = src.replace(/^\/high-tail-atlas(?=\/)/, "");
    const rel = stripped.replace(/^\/+/, "");
    return firstExisting(join(exportRoot, rel), join(outDir, rel));
  };

  let firstLoad = 0;
  const firstLoadFiles = new Set();
  for (const src of srcs) {
    const file = toFile(src);
    if (!file || extname(file) !== ".js") continue;
    firstLoadFiles.add(file);
    firstLoad += gzipSync(readFileSync(file)).length;
  }

  let allJs = 0;
  let mapJs = 0;
  for (const file of walk(staticRoot)) {
    if (extname(file) !== ".js") continue;
    const gz = gzipSync(readFileSync(file)).length;
    allJs += gz;
    const rel = relative(staticRoot, file).replaceAll("\\", "/");
    if (/choropleth/i.test(rel) && !firstLoadFiles.has(file)) mapJs += gz;
  }

  const withMap = firstLoad + mapJs;
  if (firstLoad === 0) {
    failures.push("could not measure first-load JS from out/index.html");
  }
  console.log(
    `first-load JS gzip (map excluded): ${kb(firstLoad)} (stretch ${kb(250 * 1024)})`,
  );
  console.log(
    `first-load JS gzip (including map chunks): ${kb(withMap)} (budget ${kb(JS_GZIP_MAX)})`,
  );
  console.log(`all _next/static JS gzip: ${kb(allJs)}`);

  if (withMap >= JS_GZIP_MAX) {
    failures.push(
      `first-load JS gzip including map is ${kb(withMap)}; committed budget is ${kb(JS_GZIP_MAX)}`,
    );
  }
} else if (existsSync(outDir)) {
  console.log("JS budget skipped: no index.html / _next/static in out/");
}

if (failures.length) {
  console.error("Size budgets failed:\n" + failures.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}

console.log("Size budgets passed.");
