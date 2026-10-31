// features/risks/services/concept-findings.ts
//
// What the cybersecurity goals and claims still lack (ISO/SAE 21434 9.4,
// RQ-09-05/06; conformance plan Phase 4, decision 25). Only under
// `iso-21434` — other presets get no findings (the objects are optional
// there). Pure: no React, no i18n — the views render the codes.
//
// Per risk, by its own treatment (links are per risk):
//   GOAL_MISSING        reduce without a goal
//   CLAIM_MISSING       retain / share without a claim of that kind
//   AVOID_UNJUSTIFIED   avoid without a treatment justification
//   CONTROL_MISSING     reduce without a selected mitigation (rejected ones
//                       do not count) — the reduction has no control
//   RESIDUAL_MISSING    reduce, risk value rated, but no residual after
//                       mitigation (2026-10-30: the Headlamp example showed
//                       "–" everywhere and nothing said so)
//   TREATMENT_MISMATCH  a goal on a risk no longer reduced, a claim whose kind
//                       no longer fits — the link stays until the analyst
//                       decides
// Per goal / claim:
//   EMPTY_STATEMENT     no statement
//   NO_ASSUMPTION       retain claim without an assumption
//   NO_PARTY            share claim without a responsible party
//   INVALID_ASSUMPTION  claim relying on an assumption marked invalid
//   REVIEW_OVERDUE      claim past its review date
//   REMOVED_RISK        linked to a risk that no longer exists
//   UNUSED              linked to no existing risk (info)

import type { Assumption, CybersecurityConcept } from "shared";
import type { Risk } from "../models/risk-assessment-types";
import { conceptKindFor } from "../models/concept-kind";

export type ConceptFindingCode =
  | "GOAL_MISSING"
  | "CLAIM_MISSING"
  | "AVOID_UNJUSTIFIED"
  | "CONTROL_MISSING"
  | "RESIDUAL_MISSING"
  | "TREATMENT_MISMATCH"
  | "EMPTY_STATEMENT"
  | "NO_ASSUMPTION"
  | "NO_PARTY"
  | "INVALID_ASSUMPTION"
  | "REVIEW_OVERDUE"
  | "REMOVED_RISK"
  | "UNUSED";

export interface ConceptFinding {
  code: ConceptFindingCode;
  severity: "warning" | "info";
  /** The risk it is about (per-risk findings, TREATMENT_MISMATCH). */
  riskId?: string;
  /** The goal / claim it is about, by display id. */
  item?: string;
  /** Assumption display ids (INVALID_ASSUMPTION). */
  assumptions?: string[];
}

export interface ConceptFindingsInput {
  risks: readonly Risk[];
  concept: CybersecurityConcept | undefined;
  assumptions?: readonly Assumption[];
  isoMode: boolean;
  /** ISO date (YYYY-MM-DD). */
  today: string;
}

export function conceptFindings(input: ConceptFindingsInput): ConceptFinding[] {
  if (!input.isoMode) return [];
  const goals = input.concept?.goals ?? [];
  const claims = input.concept?.claims ?? [];
  const riskIds = new Set(input.risks.map((r) => r.id));
  const assumptionById = new Map((input.assumptions ?? []).map((a) => [a.id, a]));
  const out: ConceptFinding[] = [];

  for (const risk of input.risks) {
    const kind = conceptKindFor(risk.treatment);
    const myGoals = goals.filter((g) => g.riskIds.includes(risk.id));
    const myClaims = claims.filter((c) => c.riskIds.includes(risk.id));
    if (kind === "goal" && myGoals.length === 0) {
      out.push({ code: "GOAL_MISSING", severity: "warning", riskId: risk.id });
    }
    if (kind === "goal" && !(risk.selectedMitigations ?? []).some((m) => m.status !== "rejected")) {
      out.push({ code: "CONTROL_MISSING", severity: "warning", riskId: risk.id });
    }
    if (kind === "goal" && risk.isoRisk && !risk.isoRisk.residual) {
      out.push({ code: "RESIDUAL_MISSING", severity: "warning", riskId: risk.id });
    }
    if ((kind === "retain" || kind === "share") && !myClaims.some((c) => c.kind === kind)) {
      out.push({ code: "CLAIM_MISSING", severity: "warning", riskId: risk.id });
    }
    if (kind === "avoid" && !risk.treatmentJustification?.trim()) {
      out.push({ code: "AVOID_UNJUSTIFIED", severity: "warning", riskId: risk.id });
    }
    for (const g of kind === "goal" ? [] : myGoals) {
      out.push({ code: "TREATMENT_MISMATCH", severity: "warning", riskId: risk.id, item: g.displayId });
    }
    for (const c of myClaims.filter((c) => c.kind !== kind)) {
      out.push({ code: "TREATMENT_MISMATCH", severity: "warning", riskId: risk.id, item: c.displayId });
    }
  }

  for (const item of [...goals, ...claims]) {
    if (!item.statement.trim()) out.push({ code: "EMPTY_STATEMENT", severity: "warning", item: item.displayId });
    const removed = item.riskIds.filter((id) => !riskIds.has(id));
    if (removed.length > 0) out.push({ code: "REMOVED_RISK", severity: "warning", item: item.displayId });
    if (item.riskIds.length === removed.length) out.push({ code: "UNUSED", severity: "info", item: item.displayId });
  }

  for (const c of claims) {
    if (c.kind === "retain" && c.assumptionIds.length === 0) {
      out.push({ code: "NO_ASSUMPTION", severity: "warning", item: c.displayId });
    }
    if (c.kind === "share" && !c.responsibleParty?.trim()) {
      out.push({ code: "NO_PARTY", severity: "warning", item: c.displayId });
    }
    const invalid = c.assumptionIds
      .map((id) => assumptionById.get(id))
      .filter((a): a is Assumption => a?.status === "invalid")
      .map((a) => a.displayId);
    if (invalid.length > 0) {
      out.push({ code: "INVALID_ASSUMPTION", severity: "warning", item: c.displayId, assumptions: invalid });
    }
    if (c.reviewBy && c.reviewBy < input.today) {
      out.push({ code: "REVIEW_OVERDUE", severity: "warning", item: c.displayId });
    }
  }
  return out;
}

/** Warnings per risk id — the marker in the risk table. */
export function conceptWarningsByRisk(findings: readonly ConceptFinding[]): Map<string, ConceptFinding[]> {
  const map = new Map<string, ConceptFinding[]>();
  for (const f of findings) {
    if (!f.riskId || f.severity !== "warning") continue;
    map.set(f.riskId, [...(map.get(f.riskId) ?? []), f]);
  }
  return map;
}
