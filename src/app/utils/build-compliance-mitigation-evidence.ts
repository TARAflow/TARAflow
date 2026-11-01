// src/app/utils/build-compliance-mitigation-evidence.ts
//
// IEC 62443-4-2 matrix (iec-62443-4-2-cra-coverage.md D-6, D-16, D-21): the
// mitigations chosen in the risk treatment that name IEC 62443 requirements,
// with the DFD elements their risks concern — the evaluator counts one only
// when those elements meet the component scope (D-16), and in the achieved
// run only in a done status.
//
// Same reading of the risks as the closed-loop control derivation
// (use-control-instance-derivation.ts): treatments accept / eliminate /
// transfer set no control, rejected mitigations are skipped, a STRIDE threat
// concerns its element or its flow with both endpoints, an attack-path risk
// the targets of its tree's anchor (CL-3). Project mitigations (M-C-…) take
// part like catalog ones when they carry references.
//
// D-29: besides the hand-kept `iec62443` references, a mitigation meets the
// requirements its `affectsProperties` satisfy — only for the elements of the
// effect's type (typeOf), so an effect on a data flow never covers a process.

import type { RiskData } from "features/risks";
import type { MitigationEntry, ThreatData } from "features/threats";
import type { MitigationEvidence, MitigationRequirement, RequirementId } from "features/compliance";
import { mitigationRequirements } from "features/compliance";
import { DONE_MITIGATION_STATUSES } from "shared/models/control-instance";
import type { ControlTarget } from "app/hooks/use-control-instance-derivation";

function elementIdsOf(target: ControlTarget): string[] {
  if (target.linkedElement) return [target.linkedElement.elementId];
  const flow = target.dataFlow;
  return flow ? [flow.connectionId, flow.sourceId, flow.targetId].filter((id): id is string => !!id) : [];
}

export function buildComplianceMitigationEvidence(
  threatData: ThreatData | null,
  riskData: RiskData | null,
  catalog: readonly MitigationEntry[],
  resolveAnchorTargets?: (threatId: string) => ControlTarget[],
  /** Element / flow id → type ("DataFlow" for flows); without it derived requirements are not used. */
  typeOf?: (id: string) => string | undefined,
): MitigationEvidence[] {
  if (!riskData) return [];
  const requirementsOf = new Map<string, MitigationRequirement[]>();
  for (const m of catalog) {
    const reqs = mitigationRequirements(m).filter((r) => !r.elementTypes || typeOf);
    if (reqs.length > 0) requirementsOf.set(m.id, reqs);
  }
  if (requirementsOf.size === 0) return [];

  const targetsOfThreat = new Map<string, ControlTarget>();
  for (const table of threatData?.perElementTables ?? []) {
    for (const threat of table.threats) targetsOfThreat.set(threat.id, { linkedElement: threat.linkedElement, dataFlow: null });
  }
  for (const table of threatData?.perInteractionTables ?? []) {
    for (const threat of table.threats) targetsOfThreat.set(threat.id, { linkedElement: null, dataFlow: threat.dataFlow });
  }

  // One entry per chosen mitigation AND risk: its done status belongs to that
  // risk — merged over risks, a mitigation done for another component would
  // count for this one (D-16).
  const evidence: MitigationEvidence[] = [];
  for (const risk of riskData.risks ?? []) {
    if (risk.treatment === "accept" || risk.treatment === "eliminate" || risk.treatment === "transfer") continue;
    const own = targetsOfThreat.get(risk.threatId);
    const targets = own ? [own] : resolveAnchorTargets?.(risk.threatId) ?? [];
    const concernsElementIds = [...new Set(targets.flatMap(elementIdsOf))];
    for (const selected of risk.selectedMitigations ?? []) {
      if (!selected.id || selected.status === "rejected") continue;
      const reqs = requirementsOf.get(selected.id);
      if (!reqs) continue;
      const done = DONE_MITIGATION_STATUSES.includes(selected.status);
      // Referenced ids: every concerned element; derived ones: per element type.
      const referenced = reqs.filter((r) => !r.elementTypes).map((r) => r.requirementId);
      if (referenced.length > 0) evidence.push({ mitigationId: selected.id, requirementIds: referenced, done, concernsElementIds });
      const byType = new Map<string, RequirementId[]>();
      for (const r of reqs) for (const type of r.elementTypes ?? []) byType.set(type, [...(byType.get(type) ?? []), r.requirementId]);
      for (const [type, requirementIds] of byType) {
        const ofType = concernsElementIds.filter((id) => typeOf?.(id) === type);
        if (ofType.length > 0) evidence.push({ mitigationId: selected.id, requirementIds, done, concernsElementIds: ofType });
      }
    }
  }
  return evidence;
}
