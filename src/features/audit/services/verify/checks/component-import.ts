// ============ AUDIT VERIFICATION — CHECK: imported component snapshots ============
// Multi-project TARA phase 6b (design §8.2): a machine TARA embeds the
// snapshot of every imported component and records its content hash. In
// every committed *.tara.json the embedded snapshot must still hash to the
// recorded value — FNV-1a over its canonical (TCS) form, the hash the app
// computed on import / update (snapshotContentHash). A mismatch means the
// snapshot was changed after the import — by hand or by a tool (TARAflow
// itself did, before patch 82): the machine would rest on a component state
// that no commit of the component holds.
//
// Only the hash: the component pages in the DFD cannot be checked here — they
// are regenerated through the DOM (insert-component.ts), which the CLI, the
// Electron main process and the hooks do not have. The app reports changed
// pages itself (CMP_COMPONENT_PAGE_CHANGED). Review 2026-11-12.
//
// SCOPE: like tcs-repro — each commit's changed *.tara.json, every blob once.

import type { Check } from "../verify-context";
import { makeFinding } from "../findings";
import { fnv1aHex12 } from "../../../../../shared/utils/fnv1a";

const isTaraJson = (path: string) => path.endsWith(".tara.json");

interface EmbeddedImport {
  id?: string;
  name?: string;
  contentHash?: string;
  snapshot?: unknown;
}

export const checkComponentImport: Check = async ({ reader, history, canonicalize }) => {
  const findings = [];
  for (const c of history) {
    for (const cp of await reader.changedPaths(c.hash)) {
      if (cp.status === "D" || !isTaraJson(cp.path)) continue;
      const blob = await reader.readFileAt(c.hash, cp.path);
      if (blob === null) continue;
      let project: { components?: { imports?: EmbeddedImport[] } };
      try {
        project = JSON.parse(blob);
      } catch {
        continue; // reported by tcs-repro (TCS_PARSE_ERROR)
      }
      for (const imported of project.components?.imports ?? []) {
        if (!imported.snapshot || !imported.contentHash) continue;
        if (fnv1aHex12(canonicalize(imported.snapshot)) === imported.contentHash) continue;
        findings.push(
          makeFinding("CMP_SNAPSHOT_HASH_MISMATCH", {
            commit: c.hash,
            context: { path: cp.path, component: imported.name ?? imported.id ?? "?" },
          }),
        );
      }
    }
  }
  return findings;
};
