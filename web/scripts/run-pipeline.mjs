/**
 * Emit web/public/data/atlas.json from the PISA 2022 mathematics fixture.
 * Requires Python 3.11+ with the pipeline package (pip install -e ../pipeline).
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(webRoot, "..");
const pipelineSrc = join(repoRoot, "pipeline", "src");
const pipelineDir = join(repoRoot, "pipeline");
const win = process.platform === "win32";

const venvPython = join(
  pipelineDir,
  ".venv",
  win ? "Scripts/python.exe" : "bin/python",
);

const pythons = [
  process.env.PYTHON,
  existsSync(venvPython) ? venvPython : null,
  ...(win ? [] : ["python3"]),
  "python",
].filter(Boolean);

const buildArgs = [
  "-m",
  "hightail.cli",
  "build",
  "--estimates",
  join(repoRoot, "data", "fixtures", "pisa_2022_math.csv"),
  "--population",
  join(repoRoot, "data", "raw", "wpp_extract.csv"),
  "--overrides",
  join(repoRoot, "data", "overrides", "iso3_overrides.yaml"),
  "--policy",
  join(repoRoot, "data", "overrides", "territory_policy.yaml"),
  "--out",
  join(webRoot, "public", "data", "atlas.json"),
  "--reference-year",
  "2025",
  "--scale",
  "pisa",
];

const env = {
  ...process.env,
  PYTHONPATH: [pipelineSrc, process.env.PYTHONPATH]
    .filter(Boolean)
    .join(win ? ";" : ":"),
};

function run(cmd, args) {
  return spawnSync(cmd, args, {
    stdio: "inherit",
    env,
    cwd: pipelineDir,
    shell: false,
  });
}

let result = null;
for (const cmd of pythons) {
  result = run(cmd, buildArgs);
  if (result.error?.code === "ENOENT") continue;
  break;
}

if (result?.error?.code === "ENOENT") {
  result = run("py", ["-3", ...buildArgs]);
}

if (!result || result.error?.code === "ENOENT") {
  console.error(
    "run-pipeline: Python not found. Install Python 3.11+ and: python -m pip install -e ../pipeline",
  );
  process.exit(1);
}

process.exit(result.status ?? 1);
