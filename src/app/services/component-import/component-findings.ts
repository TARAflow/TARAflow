// ==================== COMPONENT FINDINGS ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §4.1, §6.3,
// §8.1): findings about the imported components, shown with the DFD's own
// findings (DFD tab). Pure.
//
//   CMP_SOURCE_UNPINNED (warning)  an import that is not pinned to a commit
//   CMP_INSTANCE_ORPHANED (error)  an instance whose multiprocess is not in
//                                  the DFD (deleted, or the DFD save of the
//                                  import was refused)
//   CMP_FLOW_NOT_IN_COMPONENT      a flow on an imported multiprocess that is
//                    (error)       none of the component's boundary flows (Q3)
//
// Also the multiprocesses whose pages belong to a component (renumber skips
// them, §6.6).

import { componentInstanceTfId, type ValidationFinding } from "features/dfd";
import type { Project } from "../../models/project-types";

export interface ComponentFindings {
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  infos: ValidationFinding[];
}

const EMPTY: ComponentFindings = { errors: [], warnings: [], infos: [] };
const KEY = (code: string) => `components.findings.${code}`;

export function componentFindings(project: Pick<Project, "components" | "dfd">): ComponentFindings {
  const components = project.components;
  if (!components || (components.imports.length === 0 && components.instances.length === 0)) return EMPTY;
  const out: ComponentFindings = { errors: [], warnings: [], infos: [] };
  const elements = new Map((project.dfd?.elements ?? []).map((e) => [e.id, e]));
  const importsById = new Map(components.imports.map((i) => [i.id, i]));

  for (const imported of components.imports) {
    if (!imported.source.unpinned) continue;
    const firstMp = components.instances.find((i) => i.importId === imported.id)?.multiprocessTfId;
    out.warnings.push({
      key: KEY("CMP_SOURCE_UNPINNED"),
      ...(firstMp && elements.has(firstMp) ? { elementId: firstMp, displayId: elements.get(firstMp)!.displayId } : {}),
      params: { component: imported.name, reason: imported.source.unpinned },
    });
  }

  for (const instance of components.instances) {
    const imported = importsById.get(instance.importId);
    const name = imported?.name ?? instance.prefix;
    const mp = elements.get(instance.multiprocessTfId);
    if (!mp) {
      out.errors.push({ key: KEY("CMP_INSTANCE_ORPHANED"), params: { prefix: instance.prefix, component: name } });
      continue;
    }
    if (!imported) continue;
    // The instance's boundary flows: component flows between an EE and the component.
    const snapshotDfd = imported.snapshot.dfd;
    const ees = new Set((snapshotDfd?.elements ?? []).filter((e) => e.type === "ExternalEntity").map((e) => e.id));
    const boundary = new Set(
      (snapshotDfd?.connections ?? [])
        .filter((c) => ees.has(c.from) !== ees.has(c.to))
        .map((c) => componentInstanceTfId(instance.id, c.id)),
    );
    for (const c of project.dfd?.connections ?? []) {
      if (c.from !== mp.id && c.to !== mp.id) continue;
      if (boundary.has(c.id)) continue;
      out.errors.push({
        key: KEY("CMP_FLOW_NOT_IN_COMPONENT"),
        elementId: c.id,
        displayId: c.displayId,
        params: { flow: [c.displayId, c.name].filter(Boolean).join(" "), component: name, prefix: instance.prefix },
      });
    }
  }
  return out;
}

/**
 * The multiprocesses whose pages belong to a component: each instance's
 * multiprocess and the component's own multiprocesses (as machine tfIds).
 */
export function importedMultiprocessIds(project: Pick<Project, "components">): string[] {
  const components = project.components;
  if (!components) return [];
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  const ids: string[] = [];
  for (const instance of components.instances) {
    ids.push(instance.multiprocessTfId);
    for (const e of importsById.get(instance.importId)?.snapshot.dfd?.elements ?? []) {
      if (e.type === "Multiprocess") ids.push(componentInstanceTfId(instance.id, e.id));
    }
  }
  return ids;
}
