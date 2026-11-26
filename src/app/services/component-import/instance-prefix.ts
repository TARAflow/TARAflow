// ==================== INSTANCE PREFIX ====================
// 0.20 manual test E3 (2026-11-26, user): the import proposed "SDC1" for the
// Smoke Detector Controller, whose own Case instances are SDC1 and SDC2 —
// the machine then read "SDC1:SDC1:CASE". Two things:
//   - the proposal leaves out the prefixes the component uses inside
//     (innerPrefixes), and the dialog refuses them;
//   - a prefix can be changed after the import (renameInstancePrefix): the
//     instance is inserted again with the new prefix — the update's path with
//     the stored snapshot, no source read. Every decision of the machine
//     hangs on the instance id, not the prefix, so they all stay; the display
//     ids follow ("SDC1:SDC1:P-1" → "C1:SDC1:P-1"), the risks' copies with the
//     next risk sync. The audit lists "Prefix: SDC1 → C1" on the instance.

import type { Project } from "../../models/project-types";
import type { ComponentSnapshot } from "../../models/component-snapshot-types";
import { applyComponentUpdate } from "./component-update";

/** What the import dialog allows (component-import-dialog PREFIX_PATTERN). */
export const INSTANCE_PREFIX_PATTERN = /^[A-Za-z0-9_-]{1,12}$/;

/**
 * The instance prefixes inside a component — of its own imports, at every
 * level: every segment before the last of a prefixed display id
 * ("SDC1:SDC2:P-1" → SDC1, SDC2).
 */
export function innerPrefixes(snapshot: Pick<ComponentSnapshot, "dfd"> | undefined): string[] {
  const out = new Set<string>();
  for (const x of [...(snapshot?.dfd?.elements ?? []), ...(snapshot?.dfd?.connections ?? [])]) {
    const segments = (x.displayId ?? "").split(":");
    for (const p of segments.slice(0, -1)) if (p) out.add(p);
  }
  return [...out].sort();
}

export type PrefixProblem = "format" | "taken" | "inner";

/**
 * Why a prefix cannot be given to an instance of an import: not 1–12
 * letters, digits, - or _; used by another instance of the machine; or one
 * the component uses inside (it would read "SDC1:SDC1:…"). Case does not
 * matter. Undefined: fine. `instanceId`: the instance being renamed (its own
 * prefix is not "taken").
 */
export function prefixProblem(
  project: Pick<Project, "components">,
  importId: string,
  prefix: string,
  instanceId?: string,
): PrefixProblem | undefined {
  if (!INSTANCE_PREFIX_PATTERN.test(prefix)) return "format";
  const upper = prefix.toUpperCase();
  const others = (project.components?.instances ?? []).filter((i) => i.id !== instanceId);
  if (others.some((i) => i.prefix.toUpperCase() === upper)) return "taken";
  const imported = project.components?.imports.find((i) => i.id === importId);
  if (innerPrefixes(imported?.snapshot as ComponentSnapshot | undefined).some((p) => p.toUpperCase() === upper)) return "inner";
  return undefined;
}

/**
 * The instance with a new prefix: inserted again (DFD pages, records, instance
 * assets) through the update's path, with the stored snapshot. The import
 * record stays as it was — no update of the component. Throws on a prefix
 * with a problem.
 */
export function renameInstancePrefix(project: Project, instanceId: string, prefix: string, at: string): Project {
  const components = project.components;
  const instance = components?.instances.find((i) => i.id === instanceId);
  const imported = instance && components?.imports.find((i) => i.id === instance.importId);
  if (!components || !instance || !imported) throw new Error(`instance ${instanceId} not found`);
  const problem = prefixProblem(project, imported.id, prefix, instanceId);
  if (problem) throw new Error(`prefix ${prefix}: ${problem}`);
  if (prefix === instance.prefix) return project;
  const renamed: Project = {
    ...project,
    components: { ...components, instances: components.instances.map((i) => (i.id === instanceId ? { ...i, prefix } : i)) },
  };
  const result = applyComponentUpdate({
    project: renamed,
    importId: imported.id,
    result: {
      snapshot: imported.snapshot as ComponentSnapshot,
      contentHash: imported.contentHash,
      source: imported.source,
      methodology: imported.methodology ?? null,
    },
    updatedAt: at,
  }).project;
  // not an update: the import record as it was (state, source, last update)
  return {
    ...result,
    components: {
      ...result.components!,
      imports: result.components!.imports.map((i) => (i.id === imported.id ? imported : i)),
    },
  };
}
