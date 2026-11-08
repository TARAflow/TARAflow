// ==================== COMPONENT TREATMENTS (read model) ====================
// Multi-project TARA, phase 3a (design §7.4): how the component treated
// each of its risks, per instance — derived from the snapshot, never stored.
//
//   - reduce: the component's measures come along read-only with their
//     status; implemented / verified count, any other status is pending
//     ("depends on a component release", CMP_MEASURE_PENDING) — in phase 3d
//     a pending measure is treated like "unclear" for the residual risk
//   - share / transfer / accept (retain): the risk arrives untreated in the
//     machine, the component's claims shown as the reason; CMP_HANDOVER_OPEN
//     until the machine sets its own treatment (an own measure, or a
//     treatment other than reduce with a justification — a justification
//     alone does not decide what the machine does with the risk)
//
// Effectiveness per instance (phase 3d-1, I7 (1)–(3)) — derived, never
// stored: a measure of the component is
//   effective      implemented / verified, and every assumption it relies on
//                  is fulfilled or not applicable in this instance (a measure
//                  relying on none is effective)
//   not effective  an assumption it relies on is not fulfilled here, or the
//                  component itself marked it invalid
//   unclear        not implemented yet (a later component release), or an
//                  assumption it relies on is still open here
// A rejected measure is no choice and counts neither way. Shown at the
// measure; phase 3d-2 makes the residual risk depend on it.
//
// Keyed by the instance's threat id (the machine risk's threatId). The
// component's project mitigations (M-C-nnn) are named from the snapshot —
// the machine has M-C ids of its own.

import { resolveMitigationDrafts } from "features/threats";
import { componentInstanceTfId } from "features/dfd";
import type { Project } from "../models/project-types";
import { instanceLabel } from "../services/component-import/instance-quantity";

export type ComponentMeasureState = "implemented" | "pending" | "rejected";
export type MeasureEffectiveness = "effective" | "not_effective" | "unclear";

/** Why a measure is not (or not yet) effective in an instance. */
export interface EffectivenessReason {
  kind: "pending" | "aou_open" | "aou_not_fulfilled" | "aou_invalid_in_component";
  /** The assumption's display id (aou_*). */
  assumption?: string;
}

export interface ComponentMeasure {
  id?: string;
  /** Catalog / component project mitigation text, else the component's notes. */
  text: string;
  status: string;
  state: ComponentMeasureState;
  /** Display ids of the component's assumptions it relies on (phase 3c). */
  reliesOn?: string[];
  /** In this instance (phase 3d-1); absent for a rejected measure. */
  effectiveness?: MeasureEffectiveness;
  /** Why not effective / unclear. */
  reasons?: EffectivenessReason[];
}

export interface ComponentTreatment {
  instanceId: string;
  /** "SD1 · Smoke Detector" */
  instanceLabel: string;
  /** The component's risk id (snapshot). */
  componentRiskId: string;
  treatment: string;
  justification?: string;
  measures: ComponentMeasure[];
  /** Claims of the component that cover this risk (share / retain — the reason a handover arrives untreated). */
  claims: { displayId: string; kind: string; statement: string; responsibleParty?: string }[];
  /** share / transfer / accept: the risk arrives untreated, the machine decides. */
  handedOver: boolean;
}

type Components = NonNullable<Project["components"]>;
type Risk = NonNullable<Project["risks"]>["risks"][number];

const HANDOVER = new Set(["share", "transfer", "accept"]);
const DONE = new Set(["implemented", "verified"]);

export function measureState(status: string): ComponentMeasureState {
  return DONE.has(status) ? "implemented" : status === "rejected" ? "rejected" : "pending";
}

/** The component's treatment of every imported risk, by the instance's threat id. */
export function componentTreatments(project: Pick<Project, "components">): Map<string, ComponentTreatment> {
  const out = new Map<string, ComponentTreatment>();
  const components: Components | null | undefined = project.components;
  if (!components) return out;
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  for (const instance of components.instances) {
    const imported = importsById.get(instance.importId);
    if (!imported) continue;
    const snapshot = imported.snapshot;
    const own = new Map((snapshot.threats?.customMitigations ?? []).map((m) => [m.id, m.text]));
    const label = instanceLabel(instance, imported.name);
    const relying = (id: string | undefined) => (id ? (snapshot.assumptions ?? []).filter((a) => a.mitigationIds?.includes(id)) : []);
    const aouStatus = new Map((instance.assumptions ?? []).map((a) => [a.assumptionId, a.status]));
    for (const risk of snapshot.risks) {
      const measures = risk.selectedMitigations
        .filter((m) => m.status !== undefined)
        .map((m): ComponentMeasure => {
          const text = (m.id && own.get(m.id)) || (m.id ? resolveMitigationDrafts([{ id: m.id }])[0]?.text : "") || m.notes || m.id || "";
          const relies = relying(m.id);
          const state = measureState(m.status);
          const verdict = state === "rejected" ? undefined : effectivenessOf(state, relies, aouStatus);
          return {
            ...(m.id ? { id: m.id } : {}),
            text,
            status: m.status,
            state,
            ...(relies.length > 0 ? { reliesOn: relies.map((a) => a.displayId) } : {}),
            ...(verdict ? { effectiveness: verdict.effectiveness, ...(verdict.reasons.length > 0 ? { reasons: verdict.reasons } : {}) } : {}),
          };
        });
      const claims = (snapshot.concept?.claims ?? [])
        .filter((c) => c.riskIds.includes(risk.id))
        .map((c) => ({
          displayId: c.displayId,
          kind: c.kind,
          statement: c.statement,
          ...(c.responsibleParty ? { responsibleParty: c.responsibleParty } : {}),
        }));
      out.set(componentInstanceTfId(instance.id, `threat|${risk.threatId}`), {
        instanceId: instance.id,
        instanceLabel: label,
        componentRiskId: risk.id,
        treatment: risk.treatment,
        ...(risk.treatmentJustification ? { justification: risk.treatmentJustification } : {}),
        measures,
        claims,
        handedOver: HANDOVER.has(risk.treatment),
      });
    }
  }
  return out;
}

/** A measure's effectiveness in one instance, with the reasons (I7 (3)). */
export function effectivenessOf(
  state: Exclude<ComponentMeasureState, "rejected">,
  relies: readonly { id: string; displayId: string; status: string }[],
  aouStatus: ReadonlyMap<string, string>,
): { effectiveness: MeasureEffectiveness; reasons: EffectivenessReason[] } {
  const reasons: EffectivenessReason[] = [];
  for (const a of relies) {
    if (a.status === "invalid") reasons.push({ kind: "aou_invalid_in_component", assumption: a.displayId });
    const here = aouStatus.get(a.id) ?? "open";
    if (here === "not_fulfilled") reasons.push({ kind: "aou_not_fulfilled", assumption: a.displayId });
    else if (here === "open") reasons.push({ kind: "aou_open", assumption: a.displayId });
  }
  if (state === "pending") reasons.unshift({ kind: "pending" });
  const effectiveness: MeasureEffectiveness = reasons.some((r) => r.kind === "aou_not_fulfilled" || r.kind === "aou_invalid_in_component")
    ? "not_effective"
    : reasons.length > 0
      ? "unclear"
      : "effective";
  return { effectiveness, reasons };
}

/**
 * Has the machine decided a handed-over risk? Its own measure, or its own
 * treatment other than "reduce" with a justification. A justification alone
 * does not tell what the machine does with the risk (review 2026-11-08).
 */
export function machineDecided(risk: Pick<Risk, "treatment" | "treatmentJustification" | "selectedMitigations">): boolean {
  if ((risk.selectedMitigations ?? []).length > 0) return true;
  return risk.treatment !== "reduce" && !!(risk.treatmentJustification ?? "").trim();
}
