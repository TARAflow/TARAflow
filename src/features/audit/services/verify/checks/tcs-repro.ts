// ============ AUDIT VERIFICATION — CHECK: TCS reproducibility ============
// Every committed *.tara.json must be byte-identical to a fresh canonical TCS
// re-serialization of itself (TCS-v1.md reproducibility contract).
//
// SEMANTICS (C-sem-1): pure format-idempotency — `canonicalize(JSON.parse(blob))
// === blob`. This uses only the canonical FORMATTER (injected), not the
// `prepareForDisk` reduction, so it is schema-agnostic and safe across history
// (applying today's field-stripping to old blobs would false-fail on drift).
//
// SCOPE (C-scope-3): each commit's CHANGED *.tara.json only (added/modified,
// not deleted) — so every blob version is checked exactly once, at the commit
// that introduced it, giving history-wide coverage without re-walking trees.

import type { Check } from "../verify-context";
import { makeFinding } from "../findings";

const isTaraJson = (path: string) => path.endsWith(".tara.json");

export const checkTcsRepro: Check = async ({ reader, history, canonicalize }) => {
  const findings = [];
  for (const c of history) {
    const changed = await reader.changedPaths(c.hash);
    for (const cp of changed) {
      if (cp.status === "D" || !isTaraJson(cp.path)) continue;

      const blob = await reader.readFileAt(c.hash, cp.path);
      if (blob === null) continue; // add/modify but absent — nothing to check

      let reserialized: string;
      try {
        reserialized = canonicalize(JSON.parse(blob));
      } catch {
        findings.push(
          makeFinding("TCS_PARSE_ERROR", {
            commit: c.hash,
            context: { path: cp.path },
          }),
        );
        continue;
      }

      if (reserialized !== blob) {
        findings.push(
          makeFinding("TCS_NONREPRODUCIBLE", {
            commit: c.hash,
            context: { path: cp.path },
          }),
        );
      }
    }
  }
  return findings;
};
