"use client";

import { useEffect, useState } from "react";
import { atlasHref } from "@/lib/atlas";
import { AtlasFile, type AtlasManifest } from "@/lib/schema";

type Status =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; manifest: AtlasManifest };

export function ManifestView() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(atlasHref(), { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`Failed to fetch atlas.json (${res.status})`);
        }
        const parsed = AtlasFile.parse(await res.json());
        if (!cancelled) {
          setStatus({ kind: "ok", manifest: parsed.manifest });
        }
      } catch (err) {
        if (!cancelled) {
          setStatus({
            kind: "error",
            message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (status.kind === "loading") {
    return <p className="mt-3 text-sm text-stone-700">Loading manifest…</p>;
  }
  if (status.kind === "error") {
    return (
      <p className="mt-3 text-sm text-stone-700" role="alert">
        Could not load the published artifact: {status.message}
      </p>
    );
  }

  const { manifest } = status;
  return (
    <div className="mt-3">
      {manifest.flags.demo_badge || manifest.dataset_id.startsWith("demo-") ? (
        <p className="mb-3 inline-block rounded bg-amber-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-amber-950">
          DEMO DATA
        </p>
      ) : null}
      <pre
        tabIndex={0}
        aria-label="Published atlas.json manifest"
        className="overflow-x-auto rounded border border-stone-200 bg-white p-4 text-xs leading-relaxed text-stone-800"
      >
        {JSON.stringify(manifest, null, 2)}
      </pre>
    </div>
  );
}
