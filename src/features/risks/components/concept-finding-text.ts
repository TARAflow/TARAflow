// features/risks/components/concept-finding-text.ts
//
// The words for a goal / claim finding (ISO 21434 plan Phase 4, P4-2).

import type { ConceptFinding } from "../services/concept-findings";

type T = (key: string, options?: Record<string, unknown>) => string;

export function conceptFindingText(f: ConceptFinding, t: T, riskLabel: (riskId: string) => string): string {
  const risk = f.riskId ? riskLabel(f.riskId) : "";
  const K = "tabs.risks.conceptFindings";
  switch (f.code) {
    case "GOAL_MISSING":
      return t(`${K}.goalMissing`, { defaultValue: "{{risk}}: Reduce without a cybersecurity goal", risk });
    case "CLAIM_MISSING":
      return t(`${K}.claimMissing`, { defaultValue: "{{risk}}: Retain / Share without a cybersecurity claim", risk });
    case "AVOID_UNJUSTIFIED":
      return t(`${K}.avoidUnjustified`, { defaultValue: "{{risk}}: Avoid without a justification", risk });
    case "TREATMENT_MISMATCH":
      return t(`${K}.treatmentMismatch`, {
        defaultValue: "{{risk}}: {{item}} no longer fits the treatment",
        risk,
        item: f.item,
      });
    case "EMPTY_STATEMENT":
      return t(`${K}.emptyStatement`, { defaultValue: "{{item}} has no statement", item: f.item });
    case "NO_ASSUMPTION":
      return t(`${K}.noAssumption`, { defaultValue: "{{item}}: retained without an assumption", item: f.item });
    case "NO_PARTY":
      return t(`${K}.noParty`, { defaultValue: "{{item}}: shared without a responsible party", item: f.item });
    case "INVALID_ASSUMPTION":
      return t(`${K}.invalidAssumption`, {
        defaultValue: "{{item}} relies on {{list}}, marked invalid",
        item: f.item,
        list: (f.assumptions ?? []).join(", "),
      });
    case "REVIEW_OVERDUE":
      return t(`${K}.reviewOverdue`, { defaultValue: "{{item}}: review date passed", item: f.item });
    case "REMOVED_RISK":
      return t(`${K}.removedRisk`, { defaultValue: "{{item}} is linked to a risk that no longer exists", item: f.item });
    case "UNUSED":
      return t(`${K}.unused`, { defaultValue: "{{item}} is not linked to any risk", item: f.item });
  }
}
