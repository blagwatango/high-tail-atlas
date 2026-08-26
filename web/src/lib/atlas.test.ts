import { describe, expect, it } from "vitest";
import { atlasHrefFrom } from "./atlas";

describe("atlasHrefFrom", () => {
  it("resolves data/atlas.json under the origin when basePath is empty", () => {
    expect(atlasHrefFrom("http://127.0.0.1:3000", "")).toBe(
      "http://127.0.0.1:3000/data/atlas.json",
    );
  });

  it("inserts NEXT_PUBLIC_BASE_PATH whether or not it has a trailing slash", () => {
    expect(atlasHrefFrom("https://example.github.io", "/high-tail-atlas")).toBe(
      "https://example.github.io/high-tail-atlas/data/atlas.json",
    );
    expect(atlasHrefFrom("https://example.github.io", "/high-tail-atlas/")).toBe(
      "https://example.github.io/high-tail-atlas/data/atlas.json",
    );
  });
});
