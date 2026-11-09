// ==================== COMPONENT SCOPE ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §7.1,
// patch 12): the machine tfIds of the parts of every imported component —
// its elements (not its EEs, which became machine elements, E1) and its
// flows (internal and boundary flows). The threat generators skip them;
// on a boundary flow the machine-side perspective is still generated
// (victimRole rule in the per-interaction generator). Pure.

import { componentInstanceTfId, isStructuralFinding } from "features/dfd";
import type { Project } from "../../models/project-types";
import { instanceLabel } from "./instance-quantity";

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

/** Who owns a machine cell that came with a component (phase 4a, design §8.1). */
export interface CellOwner {
  /** "SD1" */
  prefix: string;
  /** "SD1 · Smoke Detector" */
  label: string;
  /** A boundary flow: the connection is the machine's, its properties the component's. */
  boundary: boolean;
}

/**
 * Machine tfId → the component instance it came with: the component's
 * elements and flows (not its EEs — machine elements, E1). Boundary flows
 * (one end at a component EE) are marked: structure there is the machine's.
 */
export function componentOwnership(project: Pick<Project, "components">): Map<string, CellOwner> {
  const out = new Map<string, CellOwner>();
  const components = project.components;
  if (!components) return out;
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  for (const instance of components.instances) {
    const imported = importsById.get(instance.importId);
    const dfd = imported?.snapshot.dfd;
    if (!imported || !dfd) continue;
    const owner = { prefix: instance.prefix, label: instanceLabel(instance, imported.name) };
    const ees = new Set((dfd.elements ?? []).filter((e) => e.type === "ExternalEntity").map((e) => e.id));
    for (const e of dfd.elements ?? []) {
      if (!ees.has(e.id)) out.set(componentInstanceTfId(instance.id, e.id), { ...owner, boundary: false });
    }
    for (const c of dfd.connections ?? []) {
      if (ees.has(c.from) && ees.has(c.to)) continue; // dropped on import
      out.set(componentInstanceTfId(instance.id, c.id), { ...owner, boundary: ees.has(c.from) || ees.has(c.to) });
    }
  }
  return out;
}

/**
 * The component owning a finding on a cell, or undefined when the machine
 * fixes it: on a boundary flow a structural finding (connection, endpoints,
 * leveled identity) is the machine's; property findings and property
 * suggestions (no key) are the component's (review 2026-11-09).
 */
export function findingOwner(owners: ReadonlyMap<string, CellOwner> | undefined, cellId: string, findingKey?: string): CellOwner | undefined {
  const owner = owners?.get(cellId);
  if (!owner) return undefined;
  if (owner.boundary && findingKey && isStructuralFinding(findingKey)) return undefined;
  return owner;
}
