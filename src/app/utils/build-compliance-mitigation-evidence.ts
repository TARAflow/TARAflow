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

import type { RiskData } from "features/risks";
import type { MitigationEntry, ThreatData } from "features/threats";
import type { MitigationEvidence, RequirementId } from "features/compliance";
import { REQUIREMENT_IDS } from "features/compliance";
import { DONE_MITIGATION_STATUSES } from "shared/models/control-instance";
import type { ControlTarget } from "app/hooks/use-control-instance-derivation";

const KNOWN_IDS = new Set<string>(REQUIREMENT_IDS);

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
): MitigationEvidence[] {
  if (!riskData) return [];
  const referencing = new Map(
    catalog.filter((m) => m.iec62443?.length).map((m) => [m.id, m.iec62443!.filter((id) => KNOWN_IDS.has(id)) as RequirementId[]]),
  );
  if (referencing.size === 0) return [];

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
      const requirementIds = referencing.get(selected.id);
      if (!requirementIds?.length) continue;
      evidence.push({
        mitigationId: selected.id,
        requirementIds,
        done: DONE_MITIGATION_STATUSES.includes(selected.status),
        concernsElementIds,
      });
    }
  }
  return evidence;
}
