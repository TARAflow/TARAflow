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
// Keyed by the instance's threat id (the machine risk's threatId). The
// component's project mitigations (M-C-nnn) are named from the snapshot —
// the machine has M-C ids of its own.

import { resolveMitigationDrafts } from "features/threats";
import { componentInstanceTfId } from "features/dfd";
import type { Project } from "../models/project-types";
import { instanceLabel } from "../services/component-import/instance-quantity";

export type ComponentMeasureState = "implemented" | "pending" | "rejected";

export interface ComponentMeasure {
  id?: string;
  /** Catalog / component project mitigation text, else the component's notes. */
  text: string;
  status: string;
  state: ComponentMeasureState;
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
    for (const risk of snapshot.risks) {
      const measures = risk.selectedMitigations
        .filter((m) => m.status !== undefined)
        .map((m): ComponentMeasure => {
          const text = (m.id && own.get(m.id)) || (m.id ? resolveMitigationDrafts([{ id: m.id }])[0]?.text : "") || m.notes || m.id || "";
          return { ...(m.id ? { id: m.id } : {}), text, status: m.status, state: measureState(m.status) };
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

/**
 * Has the machine decided a handed-over risk? Its own measure, or its own
 * treatment other than "reduce" with a justification. A justification alone
 * does not tell what the machine does with the risk (review 2026-11-08).
 */
export function machineDecided(risk: Pick<Risk, "treatment" | "treatmentJustification" | "selectedMitigations">): boolean {
  if ((risk.selectedMitigations ?? []).length > 0) return true;
  return risk.treatment !== "reduce" && !!(risk.treatmentJustification ?? "").trim();
}
