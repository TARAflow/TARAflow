// ==================== COMPONENT IMPORT FLOW ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §5, §6.4):
// the pure steps between the import dialog and the DFD — what the dialog
// shows about a component, the machine elements an EE can be mapped to, the
// default prefix, and applying the analyst's choice (insert the instance,
// extend project.components). The dialog (features/components) and the
// DFD (features/dfd) stay independent; this layer joins them.

import type { ComponentImport, ComponentInstance, ProjectComponents } from "shared";
import {
  insertComponentInstance,
  parseDfd,
  type ComponentInsertContext,
  type ComponentInsertOutcome,
} from "features/dfd";
import type { ComponentImportCandidate, MachineElementOption } from "features/components";
import type { Project } from "../../models/project-types";
import type { ComponentSnapshot } from "../../models/component-snapshot-types";
import type { ComponentSourceOk } from "./component-source";

const BOUNDARY_TYPES = new Set(["TrustBoundary", "PhysicalBoundary", "ChipBoundary"]);
/** Element types an EE can stand for in the machine (no boundaries, no interfaces). */
const MAPPABLE_TYPES = new Set(["ExternalEntity", "Process", "Multiprocess", "DataStore", "Sensor", "Actuator"]);

const label = (displayId: string | undefined, name: string | undefined, id: string) =>
  [displayId, name].filter((s) => s && s.trim()).join(" ") || id;

/** The component's state already imported in the machine (one state per component, E12). */
export function existingImportOf(
  machine: Pick<Project, "components">,
  componentId: string,
): ComponentImport<ComponentSnapshot> | undefined {
  return machine.components?.imports.find((i) => i.componentId === componentId);
}

/**
 * Default instance prefix: the initials of the component name (up to three
 * letters, "Smoke Detector" → "SD") and the next free number.
 */
export function defaultPrefix(componentName: string, existingPrefixes: readonly string[]): string {
  const words = componentName.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const initials =
    (words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "C").slice(0, 3)).slice(0, 3).toUpperCase() || "C";
  const taken = new Set(existingPrefixes.map((p) => p.toUpperCase()));
  for (let n = 1; ; n++) {
    const candidate = `${initials}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Component flows from an EE to a boundary element (design §17 I2): they
 * cannot be stitched in the machine and are listed in the preview.
 */
export function unresolvableFlows(snapshot: ComponentSnapshot): string[] {
  const elements = new Map((snapshot.dfd?.elements ?? []).map((e) => [e.id, e]));
  const isEe = (id: string) => elements.get(id)?.type === "ExternalEntity";
  const isBoundary = (id: string) => BOUNDARY_TYPES.has(elements.get(id)?.type ?? "");
  return (snapshot.dfd?.connections ?? [])
    .filter((c) => (isEe(c.from) && isBoundary(c.to)) || (isEe(c.to) && isBoundary(c.from)))
    .map((c) => label(c.displayId, c.name, c.id));
}

/** What the dialog shows about a component that was read successfully. */
export function candidateFrom(
  result: Pick<ComponentSourceOk, "snapshot" | "source" | "contentHash">,
  machine: Pick<Project, "components">,
): ComponentImportCandidate {
  const existing = existingImportOf(machine, result.snapshot.component.projectId);
  // A second import uses the state already imported (one state per component;
  // the update path follows in phase 5).
  const snapshot = existing?.snapshot ?? result.snapshot;
  const prefixes = (machine.components?.instances ?? []).map((i) => i.prefix);
  return {
    name: snapshot.component.name,
    source: existing?.source ?? result.source,
    externalEntities: (snapshot.dfd?.elements ?? [])
      .filter((e) => e.type === "ExternalEntity")
      .map((e) => ({ id: e.id, label: label(e.displayId, e.name, e.id) })),
    unresolvableFlows: unresolvableFlows(snapshot),
    ...(existing
      ? {
          existing: {
            sameState: existing.contentHash === result.contentHash,
            label: existing.source.tag ?? existing.source.commitSha?.slice(0, 8) ?? "unpinned",
          },
        }
      : {}),
    defaultPrefix: defaultPrefix(snapshot.component.name, prefixes),
    usedPrefixes: prefixes,
  };
}

/** The machine elements on the page shown that a component EE can stand for. */
export function machineElementOptions(context: ComponentInsertContext): MachineElementOption[] {
  const parse = parseDfd(context.xml, context.pages);
  const pageId = context.pageId || parse.pages[0]?.pageId || "";
  const onPage = new Set(parse.occurrences.filter((o) => o.pageId === pageId).map((o) => o.tfId));
  return context.elements
    .filter((e) => onPage.has(e.id) && MAPPABLE_TYPES.has(e.type))
    .map((e) => ({ id: e.id, label: label(e.displayId, e.name, e.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export interface ComponentImportChoice {
  prefix: string;
  name: string;
  /** Component EE id → machine tfId; undefined = new element. */
  eeMapping: Record<string, string | undefined>;
}

export interface AppliedComponentImport {
  outcome: ComponentInsertOutcome;
  components: ProjectComponents<ComponentSnapshot>;
  instance: ComponentInstance;
}

/**
 * Applies the analyst's choice: inserts the instance into the DFD and adds
 * the import (unless the component is imported already) and the instance to
 * project.components.
 */
export function applyComponentImport(input: {
  context: ComponentInsertContext;
  machine: Pick<Project, "components">;
  result: Pick<ComponentSourceOk, "snapshot" | "source" | "contentHash" | "methodology">;
  choice: ComponentImportChoice;
  ids: { importId: string; instanceId: string };
  importedAt: string;
}): AppliedComponentImport {
  const { context, machine, result, choice, ids } = input;
  const existing = existingImportOf(machine, result.snapshot.component.projectId);
  const imported: ComponentImport<ComponentSnapshot> = existing ?? {
    id: ids.importId,
    componentId: result.snapshot.component.projectId,
    name: result.snapshot.component.name,
    source: result.source,
    importedAt: input.importedAt,
    methodology: result.methodology ?? { likelihoodMethod: "weighted-mean", factors: [], hash: "" },
    snapshot: result.snapshot,
    contentHash: result.contentHash,
  };
  const dfd = imported.snapshot.dfd;
  if (!dfd?.xml) throw new Error("The component TARA has no data flow diagram.");

  const instanceCount = (machine.components?.instances ?? []).length;
  const inserted = insertComponentInstance({
    machine: context,
    component: { xml: dfd.xml, pages: dfd.pages, elements: dfd.elements, connections: dfd.connections },
    instanceId: ids.instanceId,
    prefix: choice.prefix,
    parentPageId: context.pageId,
    multiprocess: { name: choice.name, x: 400 + 40 * instanceCount, y: 300 + 40 * instanceCount },
    eeMapping: choice.eeMapping,
  });

  const instance: ComponentInstance = {
    id: ids.instanceId,
    importId: imported.id,
    multiprocessTfId: inserted.multiprocessTfId,
    prefix: choice.prefix,
    eeMapping: Object.keys(inserted.idMap)
      .filter((id) => (dfd.elements ?? []).some((e) => e.id === id && e.type === "ExternalEntity"))
      .map((componentEeId) => ({ componentEeId, machineTfId: inserted.idMap[componentEeId] })),
    assumptions: [],
  };

  return {
    outcome: {
      xml: inserted.xml,
      pages: inserted.pages,
      elements: [...context.elements, ...inserted.elements],
      connections: [...context.connections, ...inserted.connections],
    },
    components: {
      imports: existing ? machine.components!.imports : [...(machine.components?.imports ?? []), imported],
      instances: [...(machine.components?.instances ?? []), instance],
    },
    instance,
  };
}
