// ==================== COMPONENT THREATS (read model) ====================
// Multi-project TARA (doc/Open/multi-project-tara-design.md v3, §7.1,
// patch 14): the threats of the imported components, derived per instance
// from the embedded snapshot — never stored (D1: one source, nothing
// drifts; like the attack-path threats). Pure; the CLI reporter can use it
// too, the snapshot is in the project file.
//
// Consumers (connected now or in the named phase): risk sync and the
// read-only section in the Threats tab (14), threat ↔ goal links (14),
// findings (phase 4), compliance matrix (phase 4, E6), report incl.
// provenance (phase 6, E10), CLI reporter (phase 6).
//
// Per instance:
//   - ids, element / flow / asset / boundary references → the instance's
//     machine ids (componentInstanceTfId, instanceAssetId; an EE → the
//     machine element it is mapped to); display ids with the prefix
//   - threats on the component's EEs are not taken over — an EE became a
//     machine element whose threats the machine generates (E1); nor those
//     on EE → EE flows, which were dropped on import
//   - per-interaction threats whose victim is the EE side are not taken
//     over — the machine generates that perspective (victimRole rule, patch 12)
//   - text, STRIDE, relevance as the component decided (read-only, Q2) —
//     except on boundary flows, where the machine may override the
//     relevance with a rationale (I3, patch 15)

import type { Threat, ThreatData, ThreatTable, StrideMethod } from "features/threats";
import { componentInstanceTfId, instanceAssetId } from "features/dfd";
import type { ThreatReference } from "shared";
import type { Project } from "../models/project-types";
import { extractThreatReferences } from "./extract-threat-references";

/** One imported threat as the Threats tab shows it. */
export interface ComponentThreatRow {
  /** The threat as the machine uses it (relevance override applied). */
  threat: Threat;
  /** Id of the threat in the component — key of a relevance override. */
  threatKey: string;
  /** The component's relevance decision. */
  componentRelevance: Threat["relevance"];
  /** On a boundary flow — the machine may override the relevance (I3). */
  boundary: boolean;
  override?: { relevance: Threat["relevance"]; rationale: string; date: string };
  /** The component changed its decision since the override — to review (I3). */
  stale?: boolean;
}

export interface ComponentThreatGroup {
  /** Instance id. */
  key: string;
  /** "SD1 · Smoke Detector" */
  label: string;
  threats: Threat[];
  rows: ComponentThreatRow[];
}

type Components = NonNullable<Project["components"]>;
type Instance = Components["instances"][number];

function remapThreat(threat: Threat, instance: Instance, mapId: (id: string) => string): Threat {
  const prefixed = (id: string | undefined) => (id ? `${instance.prefix}:${id}` : id);
  return {
    ...threat,
    id: componentInstanceTfId(instance.id, `threat|${threat.id}`),
    displayId: prefixed(threat.displayId) ?? threat.displayId,
    trustBoundaryId: threat.trustBoundaryId ? mapId(threat.trustBoundaryId) : threat.trustBoundaryId,
    linkedElement: threat.linkedElement
      ? {
          ...threat.linkedElement,
          elementId: mapId(threat.linkedElement.elementId),
          ...(threat.linkedElement.displayId ? { displayId: prefixed(threat.linkedElement.displayId) } : {}),
        }
      : threat.linkedElement,
    dataFlow: threat.dataFlow
      ? {
          ...threat.dataFlow,
          connectionId: mapId(threat.dataFlow.connectionId),
          sourceId: mapId(threat.dataFlow.sourceId),
          targetId: mapId(threat.dataFlow.targetId),
        }
      : threat.dataFlow,
    linkedAssetIds: (threat.linkedAssetIds ?? []).map((a) => instanceAssetId(instance.id, a)),
  } as Threat;
}

/** The component's threats of one instance, remapped and filtered. */
function instanceTables(
  instance: Instance,
  imported: Components["imports"][number],
): { perElement: ThreatTable[]; perInteraction: ThreatTable[]; rows: ComponentThreatRow[] } {
  const snapshot = imported.snapshot;
  const threats = snapshot.threats;
  if (!threats) return { perElement: [], perInteraction: [], rows: [] };
  const elements = snapshot.dfd?.elements ?? [];
  const ees = new Set(elements.filter((e) => e.type === "ExternalEntity").map((e) => e.id));
  const eeMap = new Map(instance.eeMapping.map((m) => [m.componentEeId, m.machineTfId]));
  const mapId = (id: string) => eeMap.get(id) ?? componentInstanceTfId(instance.id, id);
  const label = `${instance.prefix} · ${imported.name}`;

  // EE → EE flows were dropped on import — their threats are gone with them.
  const eeToEe = new Set(
    (snapshot.dfd?.connections ?? []).filter((c) => ees.has(c.from) && ees.has(c.to)).map((c) => c.id),
  );
  const onDroppedPart = (t: Threat) =>
    (!!t.linkedElement && (ees.has(t.linkedElement.elementId) || eeToEe.has(t.linkedElement.elementId))) ||
    (!!t.dataFlow && eeToEe.has(t.dataFlow.connectionId));
  const keepElementThreat = (t: Threat) => !onDroppedPart(t);
  const keepInteractionThreat = (t: Threat) => {
    if (onDroppedPart(t)) return false;
    if (!t.dataFlow) return true;
    const victim = t.interactionContext?.victimRole === "source" ? t.dataFlow.sourceId : t.dataFlow.targetId;
    return !ees.has(victim);
  };
  // Boundary flows: component flows with exactly one EE end (I3).
  const boundaryFlows = new Set(
    (snapshot.dfd?.connections ?? []).filter((c) => ees.has(c.from) !== ees.has(c.to)).map((c) => c.id),
  );
  const onBoundary = (t: Threat) =>
    (!!t.dataFlow && boundaryFlows.has(t.dataFlow.connectionId)) ||
    (!!t.linkedElement && boundaryFlows.has(t.linkedElement.elementId));
  const overrides = new Map((instance.relevanceOverrides ?? []).map((o) => [o.threatKey, o]));

  const rows: ComponentThreatRow[] = [];
  const table = (all: ThreatTable[], keep: (t: Threat) => boolean): ThreatTable[] => {
    const list = all.flatMap((tb) => tb.threats.filter(keep)).map((original) => {
      const boundary = onBoundary(original);
      const o = boundary ? overrides.get(original.id) : undefined;
      let threat = remapThreat(original, instance, mapId);
      if (o) threat = { ...threat, relevance: o.relevance, relevanceOverridden: true, evalNote: o.rationale };
      rows.push({
        threat,
        threatKey: original.id,
        componentRelevance: original.relevance,
        boundary,
        ...(o ? { override: { relevance: o.relevance, rationale: o.rationale, date: o.date } } : {}),
        ...(o && o.componentRelevance !== original.relevance ? { stale: true } : {}),
      });
      return threat;
    });
    return list.length > 0
      ? [{ trustBoundaryId: null, trustBoundaryName: label, displayIdentifier: `[${instance.prefix}]`, threats: list }]
      : [];
  };
  return {
    perElement: table(threats.perElementTables ?? [], keepElementThreat),
    perInteraction: table(threats.perInteractionTables ?? [], keepInteractionThreat),
    rows,
  };
}

/** The imported threats as threat data: one table per instance and method. */
export function componentThreatData(project: Pick<Project, "components">): ThreatData | null {
  const components = project.components;
  if (!components || components.instances.length === 0) return null;
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  const perElementTables: ThreatTable[] = [];
  const perInteractionTables: ThreatTable[] = [];
  for (const instance of components.instances) {
    const imported = importsById.get(instance.importId);
    if (!imported) continue;
    const t = instanceTables(instance, imported);
    perElementTables.push(...t.perElement);
    perInteractionTables.push(...t.perInteraction);
  }
  return { perElementTables, perInteractionTables, lastModified: "" } as unknown as ThreatData;
}

/** The imported threats per instance — the read-only section of the Threats tab. */
export function componentThreatGroups(project: Pick<Project, "components">): ComponentThreatGroup[] {
  const components = project.components;
  if (!components) return [];
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  return components.instances.flatMap((instance) => {
    const imported = importsById.get(instance.importId);
    if (!imported) return [];
    const t = instanceTables(instance, imported);
    const threats = t.rows.map((r) => r.threat);
    return threats.length > 0
      ? [{ key: instance.id, label: `${instance.prefix} · ${imported.name}`, threats, rows: t.rows }]
      : [];
  });
}

/** The imported threats as the risk register sees them (ThreatReference). */
export function componentThreatReferences(
  project: Pick<Project, "components" | "assets" | "dfd">,
  method: StrideMethod,
): ThreatReference[] {
  return extractThreatReferences(
    componentThreatData(project),
    method,
    project.assets?.assets,
    (project.dfd as { elements?: unknown } | null)?.elements as Parameters<typeof extractThreatReferences>[3],
  );
}

/**
 * Stored threats plus the imported ones — for consumers that read whole
 * threat data (e.g. the threat ↔ goal links). Null stays null without imports.
 */
export function withComponentThreats(
  threats: ThreatData | null | undefined,
  project: Pick<Project, "components">,
): ThreatData | null | undefined {
  const imported = componentThreatData(project);
  if (!imported) return threats;
  const base = threats ?? ({ perElementTables: [], perInteractionTables: [], lastModified: "" } as unknown as ThreatData);
  return {
    ...base,
    perElementTables: [...base.perElementTables, ...imported.perElementTables],
    perInteractionTables: [...base.perInteractionTables, ...imported.perInteractionTables],
  };
}
