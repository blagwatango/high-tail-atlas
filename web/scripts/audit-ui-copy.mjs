/**
 * Fail CI if forbidden contest-of-nations copy lands in UI source.
 * Comments are ignored. Ethical refusals (methodology / "not an IQ rank") pass.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(WEB_ROOT, "src");
const OG = join(WEB_ROOT, "public", "og.png");
const ROBOTS = join(WEB_ROOT, "public", "robots.txt");
const MAX_OG_BYTES = 500_000;

const FORBIDDEN = [
  { id: "smartest", re: /\bsmartest\b/i },
  { id: "dumbest", re: /\bdumbest\b/i },
  { id: "national intelligence", re: /national intelligence/i },
  { id: "IQ rank", re: /iq rank/i },
  { id: "leaderboard", re: /\bleaderboard\b/i },
  { id: "Ranked lollipop", re: /ranked lollipop/i },
  { id: "top 40", re: /\btop 40\b/i },
];

const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".css"]);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      out.push(...walk(p));
      continue;
    }
    if (/\.test\.(ts|tsx|js|jsx)$/.test(name)) continue;
    if (SOURCE_EXT.has(extname(name))) out.push(p);
  }
  return out;
}

function stripComments(src) {
  let out = src.replace(/\/\*[\s\S]*?\*\//g, (m) => " ".repeat(m.length));
  out = out.replace(/(^|[^:])\/\/.*$/gm, (m, p1) => p1 + " ".repeat(m.length - p1.length));
  return out;
}

function isRefusal(ctx) {
  const s = ctx.toLowerCase().replace(/[“”]/g, '"');
  return (
    s.includes("will not") ||
    s.includes("do not use") ||
    s.includes("never use") ||
    s.includes("not an iq rank") ||
    s.includes("not a ranking") ||
    s.includes("refuse") ||
    s.includes("forbidden") ||
    /no\s+"dumbest/.test(s) ||
    /not\s+"dumbest/.test(s)
  );
}

function contextAround(text, index, span) {
  const start = Math.max(0, index - 160);
  const end = Math.min(text.length, index + span + 160);
  return text.slice(start, end);
}

const files = walk(SRC);
const failures = [];
const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

for (const file of files) {
  const raw = readFileSync(file, "utf8");
  const scanned = stripComments(raw);
  const rel = relative(WEB_ROOT, file).replaceAll("\\", "/");
  for (const rule of FORBIDDEN) {
    const matches = scanned.matchAll(new RegExp(rule.re.source, "gi"));
    for (const m of matches) {
      const idx = m.index ?? 0;
      const ctx = contextAround(scanned, idx, m[0].length);
      if (isRefusal(ctx)) continue;
      const line = scanned.slice(0, idx).split("\n").length;
      failures.push(`${rel}:${line}: forbidden UI string "${rule.id}": ${m[0]}`);
    }
  }
}

const robots = readFileSync(ROBOTS, "utf8");
if (!/User-agent:\s*\*/i.test(robots) || !/Disallow:\s*\//.test(robots)) {
  failures.push("public/robots.txt must Disallow / for demo deploys");
}

const og = readFileSync(OG);
if (og.length < 8 || !og.subarray(0, 8).equals(PNG_SIG)) {
  failures.push("public/og.png must be a PNG file");
} else if (og.length >= MAX_OG_BYTES) {
  failures.push(`public/og.png is ${og.length} bytes; must stay under 500 KB`);
}

if (failures.length) {
  console.error("Copy audit failed:\n" + failures.map((f) => `  ${f}`).join("\n"));
  process.exit(1);
}

console.log(
  `Copy audit passed (${files.length} UI files; og.png ${og.length} bytes).`,
);
