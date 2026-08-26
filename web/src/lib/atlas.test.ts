import { describe, expect, it } from "vitest";
import { atlasHrefFrom, worldTopoHrefFrom } from "./atlas";

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

describe("worldTopoHrefFrom", () => {
  it("resolves world-110m.topo.json under the same public/data prefix", () => {
    expect(worldTopoHrefFrom("http://127.0.0.1:3000", "")).toBe(
      "http://127.0.0.1:3000/data/world-110m.topo.json",
    );
    expect(
      worldTopoHrefFrom("https://example.github.io", "/high-tail-atlas"),
    ).toBe(
      "https://example.github.io/high-tail-atlas/data/world-110m.topo.json",
    );
  });
});
