// ==================== COMPONENT ASSUMPTIONS PER INSTANCE ====================
// Multi-project TARA, phase 3b (design §7.6, I7 (2)): every assumption of use
// (AoU) of the component's Item Definition is a checklist entry per instance
// — open / fulfilled / not fulfilled / not applicable, with evidence (machine
// elements, machine measures, a note); "not applicable" counts as fulfilled
// but needs a rationale. Pure.
//
//   CMP_AOU_OPEN (warning)       assumptions still open in an instance
//   CMP_AOU_VIOLATED (error)     not fulfilled — the component's analysis is
//                                not valid in this machine until resolved
//   CMP_AOU_MET_BY_PENDING       "fulfilled" backed by a machine measure that
//                    (warning)   is not implemented yet. No stored coupling:
//                                the status stays "fulfilled", but the
//                                component measures relying on it count as
//                                unclear until the evidence is implemented
//                                (component-treatments, 2026-11-09)

import type { ComponentAssumptionStatus } from "shared";
import { resolveMitigationDrafts } from "features/threats";
import type { Project } from "../../models/project-types";

type Components = NonNullable<Project["components"]>;
type Instance = Components["instances"][number];
type Import = Components["imports"][number];
type Risks = NonNullable<Project["risks"]>["risks"];

export type AoUStatus = ComponentAssumptionStatus["status"];

export interface InstanceAssumption {
  assumptionId: string;
  displayId: string;
  text: string;
  /** The component's own status of the assumption (open / confirmed / invalid). */
  componentStatus: string;
  /** This instance's status (open when not recorded). */
  status: AoUStatus;
  evidence?: ComponentAssumptionStatus["evidence"];
  rationale?: string;
}

/** The component's assumptions with this instance's status. */
export function instanceAssumptions(instance: Instance, imported: Import): InstanceAssumption[] {
  const recorded = new Map((instance.assumptions ?? []).map((a) => [a.assumptionId, a]));
  return (imported.snapshot.assumptions ?? []).map((a) => {
    const own = recorded.get(a.id);
    return {
      assumptionId: a.id,
      displayId: a.displayId,
      text: a.text,
      componentStatus: a.status,
      status: own?.status ?? "open",
      ...(own?.evidence ? { evidence: own.evidence } : {}),
      ...(own?.rationale ? { rationale: own.rationale } : {}),
    };
  });
}

export interface AssumptionDecision {
  status: AoUStatus;
  evidence?: ComponentAssumptionStatus["evidence"];
  rationale?: string;
}

/** Sets an assumption's status in one instance; "open" without evidence removes the entry. */
export function withAssumptionStatus(
  components: Components,
  instanceId: string,
  assumptionId: string,
  decision: AssumptionDecision,
): Components {
  const rationale = decision.rationale?.trim();
  if (decision.status === "not_applicable" && !rationale) {
    throw new Error("Not applicable needs a rationale.");
  }
  const evidence = cleanEvidence(decision.evidence);
  return {
    ...components,
    instances: components.instances.map((i) => {
      if (i.id !== instanceId) return i;
      const others = (i.assumptions ?? []).filter((a) => a.assumptionId !== assumptionId);
      if (decision.status === "open" && !evidence && !rationale) return { ...i, assumptions: others };
      const entry: ComponentAssumptionStatus = {
        instanceId,
        assumptionId,
        status: decision.status,
        ...(evidence ? { evidence } : {}),
        ...(rationale ? { rationale } : {}),
      };
      return { ...i, assumptions: [...others, entry] };
    }),
  };
}

function cleanEvidence(e: ComponentAssumptionStatus["evidence"]): ComponentAssumptionStatus["evidence"] | undefined {
  if (!e) return undefined;
  const out: NonNullable<ComponentAssumptionStatus["evidence"]> = {};
  if (e.elementIds?.length) out.elementIds = [...e.elementIds];
  if (e.mitigationIds?.length) out.mitigationIds = [...e.mitigationIds];
  if (e.note?.trim()) out.note = e.note.trim();
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Machine measures (by id) implemented or verified on at least one of its risks. */
export function implementedMachineMeasures(risks: Risks | undefined): Set<string> {
  const out = new Set<string>();
  for (const r of risks ?? []) {
    for (const m of r.selectedMitigations ?? []) {
      if (m.id && (m.status === "implemented" || m.status === "verified")) out.add(m.id);
    }
  }
  return out;
}

export interface AssumptionGaps {
  open: InstanceAssumption[];
  violated: InstanceAssumption[];
  /** Fulfilled, backed by machine measures not implemented yet — with those ids. */
  metByPending: { assumption: InstanceAssumption; mitigationIds: string[] }[];
}

/** Per instance: open, violated and "fulfilled by a pending measure" assumptions. */
export function assumptionGaps(instance: Instance, imported: Import, risks: Risks | undefined): AssumptionGaps {
  const done = implementedMachineMeasures(risks);
  const list = instanceAssumptions(instance, imported);
  return {
    open: list.filter((a) => a.status === "open"),
    violated: list.filter((a) => a.status === "not_fulfilled"),
    metByPending: list
      .filter((a) => a.status === "fulfilled")
      .map((a) => ({ assumption: a, mitigationIds: (a.evidence?.mitigationIds ?? []).filter((id) => !done.has(id)) }))
      .filter((x) => x.mitigationIds.length > 0),
  };
}

/** A project's measures (its project mitigations and every measure its risks chose) — the evidence options of a machine, the measures a component's assumptions can name (phase 3c). */
export function projectMeasureOptions(project: Pick<Project, "risks" | "threats">): { id: string; label: string }[] {
  const out = new Map<string, string>();
  for (const m of project.threats?.configuration?.customMitigations ?? []) out.set(m.id, `${m.id} ${m.text}`);
  for (const r of project.risks?.risks ?? []) {
    for (const m of r.selectedMitigations ?? []) {
      if (!m.id || out.has(m.id)) continue;
      out.set(m.id, `${m.id} ${resolveMitigationDrafts([{ id: m.id }])[0]?.text ?? ""}`.trim());
    }
  }
  return [...out.entries()].map(([id, label]) => ({ id, label })).sort((a, b) => a.id.localeCompare(b.id));
}
