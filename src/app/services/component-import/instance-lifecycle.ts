// ==================== COMPONENT INSTANCE LIFECYCLE ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §6.7):
// deleting the multiprocess of an instance in the DFD removes the instance
// — and the import with its last instance. draw.io deletes at once; the app
// sees it with the next save and tells the user what went (user
// 2026-11-07: no confirmation before, draw.io undo before the save, the
// audit diff names it). An instance whose multiprocess was never saved
// (refused import save) is kept: CMP_INSTANCE_ORPHANED. Pure.

import { instanceAssetId } from "features/dfd";
import type { Project } from "../../models/project-types";

export interface RemovedComponentInstance {
  prefix: string;
  component: string;
  /** The instance's assets (E5) — purged with the instance. */
  assetIds: string[];
}

export interface InstancePruneResult {
  /** The new components block; undefined = unchanged. */
  components?: Project["components"];
  removed: RemovedComponentInstance[];
}

export function pruneDeletedInstances(
  current: Pick<Project, "components" | "dfd">,
  nextElements: readonly { id: string }[],
): InstancePruneResult {
  const components = current.components;
  if (!components || components.instances.length === 0) return { removed: [] };
  const before = new Set((current.dfd?.elements ?? []).map((e) => e.id));
  const after = new Set(nextElements.map((e) => e.id));
  const gone = components.instances.filter((i) => before.has(i.multiprocessTfId) && !after.has(i.multiprocessTfId));
  if (gone.length === 0) return { removed: [] };
  const goneIds = new Set(gone.map((i) => i.id));
  const instances = components.instances.filter((i) => !goneIds.has(i.id));
  const usedImports = new Set(instances.map((i) => i.importId));
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  return {
    components: { imports: components.imports.filter((i) => usedImports.has(i.id)), instances },
    removed: gone.map((i) => {
      const imported = importsById.get(i.importId);
      return {
        prefix: i.prefix,
        component: imported?.name ?? i.prefix,
        assetIds: (imported?.snapshot.assets ?? []).map((a) => instanceAssetId(i.id, a.id)),
      };
    }),
  };
}
