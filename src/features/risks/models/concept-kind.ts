// features/risks/models/concept-kind.ts
//
// Which object a risk treatment needs (ISO/SAE 21434 9.4, plan Phase 4,
// decision 25): reduce → cybersecurity goal (RQ-09-05); retain (stored as
// "accept") / share (also the legacy "transfer") → cybersecurity claim
// (RQ-09-06); avoid (stored as "eliminate") → its justification only.

import type { ClaimKind } from "shared";
import type { RiskTreatment } from "./risk-scale-types";

export type ConceptKind = "goal" | ClaimKind | "avoid";

export function conceptKindFor(treatment: RiskTreatment): ConceptKind {
  switch (treatment) {
    case "reduce":
      return "goal";
    case "accept":
      return "retain";
    case "share":
    case "transfer":
      return "share";
    case "eliminate":
      return "avoid";
  }
}
