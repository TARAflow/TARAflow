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
//   CMP_COMPONENT_PAGE_CHANGED     the component's pages differ from the
//                    (warning)     imported state — elements missing or
//                                  added there (the pages are locked in the
//                                  editor; e.g. edited in external draw.io).
//                                  Repaired with the update path (phase 5).
//
// Also the multiprocesses whose pages belong to a component (renumber skips
// them, §6.6).

import {
  componentInstanceTfId,
  lockedPageIdsOf,
  parseDfd,
  type ValidationFinding,
} from "features/dfd";
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

    const changed = pageChanges(project, instance.id, instance.multiprocessTfId, imported.snapshot.dfd);
    if (changed.missing + changed.added > 0) {
      out.warnings.push({
        key: KEY("CMP_COMPONENT_PAGE_CHANGED"),
        elementId: mp.id,
        displayId: mp.displayId,
        params: { prefix: instance.prefix, component: name, missing: changed.missing, added: changed.added },
      });
    }
  }
  return out;
}

/**
 * How the instance's pages differ from the imported state: component
 * elements / flows missing in the DFD, and definitions on the component's
 * pages that are not the component's (copies of machine elements are fine).
 */
function pageChanges(
  project: Pick<Project, "dfd">,
  instanceId: string,
  multiprocessTfId: string,
  snapshotDfd: { elements?: { id: string; type: string }[]; connections?: { id: string; from: string; to: string }[] } | null | undefined,
): { missing: number; added: number } {
  const dfd = project.dfd;
  if (!dfd?.xml || !snapshotDfd) return { missing: 0, added: 0 };
  const ees = new Set((snapshotDfd.elements ?? []).filter((e) => e.type === "ExternalEntity").map((e) => e.id));
  const expected = new Set<string>();
  for (const e of snapshotDfd.elements ?? []) if (!ees.has(e.id)) expected.add(componentInstanceTfId(instanceId, e.id));
  for (const c of snapshotDfd.connections ?? []) {
    if (ees.has(c.from) && ees.has(c.to)) continue;
    expected.add(componentInstanceTfId(instanceId, c.id));
  }
  const present = new Set([...(dfd.elements ?? []), ...(dfd.connections ?? [])].map((x) => x.id));
  const missing = [...expected].filter((id) => !present.has(id)).length;

  const componentMps = (snapshotDfd.elements ?? [])
    .filter((e) => e.type === "Multiprocess")
    .map((e) => componentInstanceTfId(instanceId, e.id));
  const pages = lockedPageIdsOf(dfd.pages, [multiprocessTfId, ...componentMps]);
  let added = 0;
  if (pages.size > 0) {
    for (const o of parseDfd(dfd.xml, dfd.pages).occurrences) {
      if (pages.has(o.pageId) && o.role === "definition" && !expected.has(o.tfId)) added++;
    }
  }
  return { missing, added };
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
