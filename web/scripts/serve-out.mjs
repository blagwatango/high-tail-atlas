/**
 * Serve web/out/ for Playwright / local preview of the static export.
 * --prefix /high-tail-atlas mounts the same folder at that path (project pages).
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { extname, join, normalize, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const OUT = join(WEB_ROOT, "out");

const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

const args = process.argv.slice(2);
let port = Number(process.env.PLAYWRIGHT_PORT || 4173);
let prefix = process.env.PLAYWRIGHT_BASE_PATH || "";
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port") port = Number(args[++i]);
  else if (args[i] === "--prefix") prefix = args[++i] || "";
}

if (!Number.isFinite(port) || port <= 0) {
  console.error("serve-out: invalid --port");
  process.exit(1);
}

prefix = prefix.trim();
if (prefix && !prefix.startsWith("/")) prefix = `/${prefix}`;
if (prefix.endsWith("/")) prefix = prefix.slice(0, -1);

if (!existsSync(OUT)) {
  console.error("serve-out: web/out is missing — run pnpm build");
  process.exit(1);
}

const nested = join(OUT, "high-tail-atlas");
const fileRoot =
  existsSync(join(nested, "data", "atlas.json")) ||
  existsSync(join(nested, "index.html"))
    ? nested
    : OUT;

function underRoot(root, candidate) {
  const rel = relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !normalize(rel).startsWith(`..${sep}`));
}

function mapPath(urlPath) {
  let pathname = decodeURIComponent(urlPath.split("?")[0] || "/");
  if (prefix) {
    if (pathname === prefix) pathname = "/";
    else if (pathname.startsWith(`${prefix}/`)) pathname = pathname.slice(prefix.length);
    else return null;
  }
  if (!pathname.startsWith("/")) pathname = `/${pathname}`;

  const rel = pathname.replace(/^\/+/, "");
  let dest = resolve(fileRoot, rel);
  if (!underRoot(fileRoot, dest)) return null;

  if (existsSync(dest) && statSync(dest).isDirectory()) {
    dest = join(dest, "index.html");
  } else if (pathname.endsWith("/")) {
    dest = join(dest, "index.html");
  }
  if (!underRoot(fileRoot, dest)) return null;
  return dest;
}

const server = http.createServer((req, res) => {
  const dest = mapPath(req.url || "/");
  if (!dest || !existsSync(dest) || !statSync(dest).isFile()) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found\n");
    return;
  }
  const type = MIME[extname(dest).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "content-type": type });
  createReadStream(dest).pipe(res);
});

server.listen(port, "127.0.0.1", () => {
  const origin = `http://127.0.0.1:${port}`;
  console.log(`serving ${fileRoot} at ${origin}${prefix || ""}/`);
});
