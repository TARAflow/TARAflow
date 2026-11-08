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

import { createDefaultThreatData, type Threat, type ThreatData, type ThreatTable, type StrideMethod } from "features/threats";
import { componentInstanceTfId, instanceAssetId } from "features/dfd";
import { compareFingerprints, type ThreatReference } from "shared";
import { projectMethodologyFingerprint } from "../services/component-import/snapshot-builder";
import type { Project } from "../models/project-types";
import { extractThreatReferences } from "./extract-threat-references";
import { instanceLabel } from "../services/component-import/instance-quantity";

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
  /**
   * Boundary-flow threats: the machine element at the flow's outer end in
   * this instance (the EE's counterpart) — instances differ exactly there.
   */
  counterpart?: string;
  /** The analysis method the threat belongs to — the Threats tab shows the active one. */
  method: StrideMethod;
}

export interface ComponentThreatGroup {
  /** Instance id. */
  key: string;
  /** Import id — the instances of one component are shown together (I5). */
  componentKey: string;
  /** Component name. */
  componentLabel: string;
  /** Instance prefix. */
  prefix: string;
  /** "SD1 · Smoke Detector" */
  label: string;
  threats: Threat[];
  rows: ComponentThreatRow[];
}

type Components = NonNullable<Project["components"]>;

/**
 * Complete threat data around derived tables — no cast hiding a missing
 * field (review 2026-11-07). The configuration is the default; readers of
 * the imported threats use the tables only.
 */
function threatDataOf(perElementTables: ThreatTable[], perInteractionTables: ThreatTable[]): ThreatData {
  return { ...createDefaultThreatData(), perElementTables, perInteractionTables, lastModified: "" };
}
type Instance = Components["instances"][number];

/** Machine element names by tfId — a component EE's name becomes its counterpart's. */
type NameOf = (machineTfId: string) => string | undefined;

function remapThreat(threat: Threat, instance: Instance, mapId: (id: string) => string, nameOf: NameOf, ees: ReadonlySet<string>): Threat {
  // Names of the flow's ends: a component EE stands for a machine element
  // in this instance (review 2026-11-08 — the EE's name was shown for every
  // instance, though one camera hangs on the PLC, the other on the HMI).
  const endName = (componentId: string, name: string) => (ees.has(componentId) ? (nameOf(mapId(componentId)) ?? name) : name);
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
          sourceName: endName(threat.dataFlow.sourceId, threat.dataFlow.sourceName),
          targetName: endName(threat.dataFlow.targetId, threat.dataFlow.targetName),
        }
      : threat.dataFlow,
    linkedAssetIds: (threat.linkedAssetIds ?? []).map((a) => instanceAssetId(instance.id, a)),
  } as Threat;
}

/** The component's threats of one instance, remapped and filtered. */
function instanceTables(
  instance: Instance,
  imported: Components["imports"][number],
  nameOf: NameOf,
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
  const table = (all: ThreatTable[], keep: (t: Threat) => boolean, method: StrideMethod): ThreatTable[] => {
    const list = all.flatMap((tb) => tb.threats.filter(keep)).map((original) => {
      const boundary = onBoundary(original);
      const o = boundary ? overrides.get(original.id) : undefined;
      let threat = remapThreat(original, instance, mapId, nameOf, ees);
      const outer = boundary && original.dataFlow ? [original.dataFlow.sourceId, original.dataFlow.targetId].find((id) => ees.has(id)) : undefined;
      const counterpart = outer ? (nameOf(mapId(outer)) ?? undefined) : undefined;
      // The machine's decision; the component's note (evalNote) stays
      // visible beside the machine's rationale (I3, review 2026-11-07).
      if (o) {
        threat = {
          ...threat,
          relevance: o.relevance,
          relevanceOverridden: true,
          importedOverride: { componentRelevance: original.relevance, rationale: o.rationale, date: o.date },
        };
      }
      rows.push({
        threat,
        threatKey: original.id,
        componentRelevance: original.relevance,
        boundary,
        method,
        ...(o ? { override: { relevance: o.relevance, rationale: o.rationale, date: o.date } } : {}),
        ...(o && o.componentRelevance !== original.relevance ? { stale: true } : {}),
        ...(counterpart ? { counterpart } : {}),
      });
      return threat;
    });
    return list.length > 0
      ? [{ trustBoundaryId: null, trustBoundaryName: label, displayIdentifier: `[${instance.prefix}]`, threats: list }]
      : [];
  };
  return {
    perElement: table(threats.perElementTables ?? [], keepElementThreat, "per-element"),
    perInteraction: table(threats.perInteractionTables ?? [], keepInteractionThreat, "per-interaction"),
    rows,
  };
}

/** The imported threats as threat data: one table per instance and method. */
type WithMachine = Pick<Project, "components"> & Partial<Pick<Project, "dfd">>;

/** Names of the machine's elements (for the counterparts of component EEs). */
function machineNames(project: WithMachine): NameOf {
  const names = new Map(((project.dfd as { elements?: { id: string; name?: string }[] } | null | undefined)?.elements ?? []).map((e) => [e.id, e.name]));
  return (id) => names.get(id) || undefined;
}

export function componentThreatData(project: WithMachine): ThreatData | null {
  const components = project.components;
  if (!components || components.instances.length === 0) return null;
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  const nameOf = machineNames(project);
  const perElementTables: ThreatTable[] = [];
  const perInteractionTables: ThreatTable[] = [];
  for (const instance of components.instances) {
    const imported = importsById.get(instance.importId);
    if (!imported) continue;
    const t = instanceTables(instance, imported, nameOf);
    perElementTables.push(...t.perElement);
    perInteractionTables.push(...t.perInteraction);
  }
  return threatDataOf(perElementTables, perInteractionTables);
}

/** The imported threats per instance — the read-only section of the Threats tab. */
export function componentThreatGroups(project: WithMachine): ComponentThreatGroup[] {
  const components = project.components;
  if (!components) return [];
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  const nameOf = machineNames(project);
  return components.instances.flatMap((instance) => {
    const imported = importsById.get(instance.importId);
    if (!imported) return [];
    const t = instanceTables(instance, imported, nameOf);
    const threats = t.rows.map((r) => r.threat);
    return threats.length > 0
      ? [
          {
            key: instance.id,
            componentKey: imported.id,
            componentLabel: imported.name,
            prefix: instance.prefix,
            label: instanceLabel(instance, imported.name),
            threats,
            rows: t.rows,
          },
        ]
      : [];
  });
}

/** The imported threats as the risk register sees them (ThreatReference). */
export function componentThreatReferences(
  project: Pick<Project, "components" | "assets" | "dfd"> & Partial<Pick<Project, "risks">>,
  method: StrideMethod,
): ThreatReference[] {
  const refs = extractThreatReferences(
    componentThreatData(project),
    method,
    project.assets?.assets,
    (project.dfd as { elements?: unknown } | null)?.elements as Parameters<typeof extractThreatReferences>[3],
  );
  return withComponentPrefill(refs, { components: project.components, risks: project.risks ?? null });
}

/**
 * Stored threats plus the imported ones — for consumers that read whole
 * threat data (e.g. the threat ↔ goal links). Null stays null without imports.
 */
export function withComponentThreats(
  threats: ThreatData | null | undefined,
  project: WithMachine,
): ThreatData | null | undefined {
  const imported = componentThreatData(project);
  if (!imported) return threats;
  const base = threats ?? threatDataOf([], []);
  return {
    ...base,
    perElementTables: [...base.perElementTables, ...imported.perElementTables],
    perInteractionTables: [...base.perInteractionTables, ...imported.perInteractionTables],
  };
}

// ==================== FACTOR PREFILL (§7.2, patch 16) ====================

/**
 * Which intrinsic factor values of each imported risk may be taken over:
 * per import, the component's fingerprint against the machine's — identical
 * → every intrinsic factor, otherwise only factors with the same id and
 * scale. Keyed by the instance threat id.
 */
export function componentFactorPrefills(
  project: Pick<Project, "components" | "risks">,
): Map<string, { factorId: string; value: number }[]> {
  const out = new Map<string, { factorId: string; value: number }[]>();
  const components = project.components;
  const machine = projectMethodologyFingerprint(project);
  if (!components || !machine) return out;
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  for (const instance of components.instances) {
    const imported = importsById.get(instance.importId);
    if (!imported) continue;
    const allowed = new Set(compareFingerprints(imported.methodology, machine).prefillFactorIds);
    if (allowed.size === 0) continue;
    for (const risk of imported.snapshot.risks) {
      const values = risk.intrinsicFactors.filter((f) => allowed.has(f.factorId));
      if (values.length === 0) continue;
      out.set(componentInstanceTfId(instance.id, `threat|${risk.threatId}`), values);
    }
  }
  return out;
}

/** References with the component's factor values attached (risk sync prefill). */
export function withComponentPrefill(
  references: ThreatReference[],
  project: Pick<Project, "components" | "risks">,
): ThreatReference[] {
  const prefills = componentFactorPrefills(project);
  if (prefills.size === 0) return references;
  return references.map((r) => (prefills.has(r.id) ? { ...r, factorPrefill: prefills.get(r.id) } : r));
}
