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
// An assumption marked fulfilled counts only once the machine measures given
// as its evidence are implemented / verified (user + review 2026-11-09:
// credited is only what is implemented, from the component or the machine);
// until then the measure is unclear with "aou_evidence_pending" — derived,
// no stored coupling: closing the evidence measure's ticket (closed loop)
// makes the measure effective and the residual risk count.
// A rejected measure is no choice and counts neither way. Shown at the
// measure; phase 3d-2a makes the residual risk depend on it.
//
// Machine override (phase 3d-2b, I7 (5)): the machine may mark a measure
// "not effective here" in an instance (ComponentInstance.measureOverrides,
// rationale mandatory) — downgrade only; it makes the measure not effective
// with the reason "overridden_here", exactly like an assumption not
// fulfilled, so the residual risk is not credited.
//
// Keyed by the instance's threat id (the machine risk's threatId). A risk of
// the component on an attack-path threat (ISO/SAE 21434) is keyed by the
// instance's path threat too — buildThreatId(instance tree id, pathKey,
// stride), the id the machine's path risk carries (component-attack-trees),
// so the rule applies per attack path (I7). The component's project
// mitigations (M-C-nnn) are named from the snapshot — the machine has M-C ids
// of its own.
//
// uncreditedResiduals (phase 3d-2a, I7 (4)): the machine risks whose
// residual risk does not count — a chosen measure of the component is not
// effective or unclear in this instance. The one derivation for the app
// (risk tab, report) and the CLI reporter; the risks / documentation
// features apply it through creditedResidual (shared).

import { resolveMitigationDrafts } from "features/threats";
import { componentInstanceTfId } from "features/dfd";
import { buildThreatId } from "features/attacktree";
import type { ResidualBlocker } from "shared";
import type { Project } from "../models/project-types";
import { instanceLabel } from "../services/component-import/instance-quantity";
import { implementedMachineMeasures } from "../services/component-import/assumption-status";

export type ComponentMeasureState = "implemented" | "pending" | "rejected";
export type MeasureEffectiveness = "effective" | "not_effective" | "unclear";

/** Why a measure is not (or not yet) effective in an instance. */
export interface EffectivenessReason {
  kind: "pending" | "aou_open" | "aou_evidence_pending" | "aou_not_fulfilled" | "aou_invalid_in_component" | "overridden_here";
  /** The assumption's display id (aou_*). */
  assumption?: string;
  /** The machine measures not implemented yet (aou_evidence_pending). */
  measures?: string[];
  /** The machine's rationale (overridden_here). */
  rationale?: string;
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
  /** Marked "not effective here" by the machine (3d-2b). */
  override?: { rationale: string; date: string };
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

/**
 * The component's treatment of every imported risk, by the instance's threat
 * id. The machine's risks tell which of its measures are implemented (the
 * evidence of fulfilled assumptions); without them every evidence counts as
 * not implemented.
 */
export function componentTreatments(
  project: Pick<Project, "components"> & { risks?: Project["risks"] | null },
): Map<string, ComponentTreatment> {
  const out = new Map<string, ComponentTreatment>();
  const components: Components | null | undefined = project.components;
  if (!components) return out;
  const done = implementedMachineMeasures(project.risks?.risks);
  const importsById = new Map(components.imports.map((i) => [i.id, i]));
  for (const instance of components.instances) {
    const imported = importsById.get(instance.importId);
    if (!imported) continue;
    const snapshot = imported.snapshot;
    const own = new Map((snapshot.threats?.customMitigations ?? []).map((m) => [m.id, m.text]));
    const label = instanceLabel(instance, imported.name);
    const relying = (id: string | undefined) => (id ? (snapshot.assumptions ?? []).filter((a) => a.mitigationIds?.includes(id)) : []);
    const aouStatus = new Map((instance.assumptions ?? []).map((a) => [a.assumptionId, a.status]));
    // fulfilled, but backed by machine measures not implemented yet → those ids
    const evidencePending = new Map(
      (instance.assumptions ?? [])
        .filter((a) => a.status === "fulfilled")
        .map((a) => [a.assumptionId, (a.evidence?.mitigationIds ?? []).filter((id) => !done.has(id))] as const)
        .filter(([, ids]) => ids.length > 0),
    );
    const overrides = new Map((instance.measureOverrides ?? []).map((o) => [o.measureId, o]));
    for (const risk of snapshot.risks) {
      const measures = risk.selectedMitigations
        .filter((m) => m.status !== undefined)
        .map((m): ComponentMeasure => {
          const text = (m.id && own.get(m.id)) || (m.id ? resolveMitigationDrafts([{ id: m.id }])[0]?.text : "") || m.notes || m.id || "";
          const relies = relying(m.id);
          const state = measureState(m.status);
          const override = m.id ? overrides.get(m.id) : undefined;
          const verdict = state === "rejected" ? undefined : effectivenessOf(state, relies, aouStatus, override, evidencePending);
          return {
            ...(m.id ? { id: m.id } : {}),
            text,
            status: m.status,
            state,
            ...(relies.length > 0 ? { reliesOn: relies.map((a) => a.displayId) } : {}),
            ...(verdict ? { effectiveness: verdict.effectiveness, ...(verdict.reasons.length > 0 ? { reasons: verdict.reasons } : {}) } : {}),
            ...(override && state !== "rejected" ? { override: { rationale: override.rationale, date: override.date } } : {}),
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
      const treatment: ComponentTreatment = {
        instanceId: instance.id,
        instanceLabel: label,
        componentRiskId: risk.id,
        treatment: risk.treatment,
        ...(risk.treatmentJustification ? { justification: risk.treatmentJustification } : {}),
        measures,
        claims,
        handedOver: HANDOVER.has(risk.treatment),
      };
      out.set(componentInstanceTfId(instance.id, `threat|${risk.threatId}`), treatment);
      const pathKey = pathThreatKey(risk.threatId, snapshot.attackTrees?.trees ?? [], instance.id);
      if (pathKey) out.set(pathKey, treatment);
    }
  }
  return out;
}

type SnapshotTree = NonNullable<NonNullable<Components["imports"][number]["snapshot"]["attackTrees"]>["trees"]>[number];

/** The instance's id of a component attack-path threat ("AT-<tree>-<pathKey>-<stride>"), else undefined. */
function pathThreatKey(threatId: string, trees: readonly SnapshotTree[], instanceId: string): string | undefined {
  if (!threatId.startsWith("AT-")) return undefined;
  for (const tree of trees) {
    for (const path of tree.pathAnalysis?.paths ?? []) {
      const stem = `${buildThreatId(tree.id, path.pathKey, "S").slice(0, -1)}`;
      if (!threatId.startsWith(stem)) continue;
      const stride = threatId.slice(stem.length);
      if (!/^[STRIDE]$/.test(stride)) continue;
      return buildThreatId(componentInstanceTfId(instanceId, `tree|${tree.id}`), path.pathKey, stride as "S");
    }
  }
  return undefined;
}

/**
 * Machine risk id → the component measures that keep its residual risk from
 * counting (not effective / unclear in this instance, I7 (4)). Pure; the app
 * report, the CLI reporter and the risk tab call it alike.
 */
export function uncreditedResiduals(
  project: Pick<Project, "components" | "risks">,
  treatments: ReadonlyMap<string, ComponentTreatment> = componentTreatments(project),
): Map<string, ResidualBlocker[]> {
  const out = new Map<string, ResidualBlocker[]>();
  if (treatments.size === 0) return out;
  for (const risk of project.risks?.risks ?? []) {
    const tr = treatments.get(risk.threatId);
    if (!tr) continue;
    const blockers = tr.measures.flatMap((m): ResidualBlocker[] =>
      m.effectiveness === "not_effective" || m.effectiveness === "unclear"
        ? [
            {
              measure: m.id ?? m.text,
              context: tr.instanceLabel,
              state: m.effectiveness,
              causes: (m.reasons ?? []).map((r) => {
                const ref = r.kind === "aou_evidence_pending" ? `${r.assumption} (${(r.measures ?? []).join(", ")})` : (r.assumption ?? r.rationale);
                return { kind: r.kind, ...(ref ? { ref } : {}) };
              }),
            },
          ]
        : [],
    );
    if (blockers.length > 0) out.set(risk.id, blockers);
  }
  return out;
}

/** A measure's effectiveness in one instance, with the reasons (I7 (3)). */
export function effectivenessOf(
  state: Exclude<ComponentMeasureState, "rejected">,
  relies: readonly { id: string; displayId: string; status: string }[],
  aouStatus: ReadonlyMap<string, string>,
  override?: { rationale: string },
  evidencePending: ReadonlyMap<string, readonly string[]> = new Map(),
): { effectiveness: MeasureEffectiveness; reasons: EffectivenessReason[] } {
  const reasons: EffectivenessReason[] = [];
  if (override) reasons.push({ kind: "overridden_here", rationale: override.rationale });
  for (const a of relies) {
    if (a.status === "invalid") reasons.push({ kind: "aou_invalid_in_component", assumption: a.displayId });
    const here = aouStatus.get(a.id) ?? "open";
    if (here === "not_fulfilled") reasons.push({ kind: "aou_not_fulfilled", assumption: a.displayId });
    else if (here === "open") reasons.push({ kind: "aou_open", assumption: a.displayId });
    else if (here === "fulfilled" && evidencePending.has(a.id)) {
      reasons.push({ kind: "aou_evidence_pending", assumption: a.displayId, measures: [...evidencePending.get(a.id)!] });
    }
  }
  if (state === "pending") reasons.unshift({ kind: "pending" });
  const effectiveness: MeasureEffectiveness = reasons.some(
    (r) => r.kind === "aou_not_fulfilled" || r.kind === "aou_invalid_in_component" || r.kind === "overridden_here",
  )
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
