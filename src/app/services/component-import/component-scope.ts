// ==================== COMPONENT SCOPE ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §7.1,
// patch 12): the machine tfIds of the parts of every imported component —
// its elements (not its EEs, which became machine elements, E1) and its
// flows (internal and boundary flows). The threat generators skip them;
// on a boundary flow the machine-side perspective is still generated
// (victimRole rule in the per-interaction generator). Pure.

import { componentInstanceTfId } from "features/dfd";
import type { Project } from "../../models/project-types";

export function componentExcludedIds(project: Pick<Project, "components">): Set<string> {
  const ids = new Set<string>();
  const components = project.components;
  if (!components) return ids;
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  for (const instance of components.instances) {
    const dfd = importsById.get(instance.importId)?.snapshot.dfd;
    if (!dfd) continue;
    const ees = new Set((dfd.elements ?? []).filter((e) => e.type === "ExternalEntity").map((e) => e.id));
    for (const e of dfd.elements ?? []) {
      if (!ees.has(e.id)) ids.add(componentInstanceTfId(instance.id, e.id));
    }
    for (const c of dfd.connections ?? []) {
      if (ees.has(c.from) && ees.has(c.to)) continue; // dropped on import
      ids.add(componentInstanceTfId(instance.id, c.id));
    }
  }
  return ids;
}
