import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { REFERENCE_P_LABEL } from "./format";
import {
  ASSUMPTIONS,
  FORMULA,
  formatSandboxShare,
} from "./methodology";
import { tailP } from "./tails";

const here = dirname(fileURLToPath(import.meta.url));
const methodologyPage = readFileSync(
  resolve(here, "../app/methodology/page.tsx"),
  "utf8",
);

describe("methodology copy", () => {
  it("page source includes estimate language and the formula", () => {
    expect(methodologyPage.toLowerCase()).toContain("estimate");
    expect(methodologyPage).toContain("{FORMULA}");
    expect(FORMULA).toBe("p = 1 - Phi((700 - mu) / sigma)");
  });

  it("lists the six pipeline assumptions", () => {
    expect(ASSUMPTIONS).toHaveLength(6);
    expect(ASSUMPTIONS[0]).toContain("far tail");
    expect(ASSUMPTIONS[3]).toContain("sigma_i = 100");
    expect(ASSUMPTIONS[4]).toContain("total population");
  });

  it("labels μ=100, σ=15 as 2.28%, never 2.275%", () => {
    const share = formatSandboxShare(tailP(100, 15), 100, 15);
    expect(share).toBe(REFERENCE_P_LABEL);
    expect(share).toBe("2.28%");
    expect(share).not.toBe("2.275%");
  });
});
