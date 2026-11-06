// ==================== REQUIREMENTS OF EVERY FAMILY ====================
// One lookup for the evaluator, the tooltip and the report: the evidence
// rules and texts of all families. The ids are disjoint (IEC 62443 "cr-…",
// EN 50742 "en-…"; completeness test), so an edition row finds its rule
// without knowing the family.

import type { AnyRequirementId, EvidenceRule } from "../models/compliance-types";
import { EVIDENCE_RULES } from "./evidence-rules";
import { REQUIREMENT_TEXTS, type RequirementText } from "./requirement-texts";
import { EN50742_A_RULES } from "./en50742-a-rules";
import { EN50742_A_TEXTS } from "./en50742-a-texts";

export const RULES_BY_ID: ReadonlyMap<AnyRequirementId, EvidenceRule<AnyRequirementId>> = new Map<
  AnyRequirementId,
  EvidenceRule<AnyRequirementId>
>([...EVIDENCE_RULES, ...EN50742_A_RULES.map((rule) => [rule.id, rule] as const)]);

export const TEXTS_BY_ID: Readonly<Record<AnyRequirementId, RequirementText>> = { ...REQUIREMENT_TEXTS, ...EN50742_A_TEXTS };
