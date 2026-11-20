// ==================== EVIDENCE RULES: EN 50742 APPROACH B ====================
// The rules of the EN rows Approach B adds (en-50742-rq-coverage.md §6.2).
// The IEC 62443-4-2 rows of Table 4 use the 2019 rules (evidence-rules.ts);
// the common clauses and 8.4 (= 7.5) use the Approach A rules.
//
// 8.3/479 (mixed components in full) is met when the relevance scope (O17)
// has elements — the scope takes each of them whole. 8.3/473 (CCSC 2) stays a
// statement row the evaluation fills: met by the model when no Table 4 row
// needs a countermeasure of the system, else the rows to name
// (evaluate-matrix withSystemCountermeasures). 8.5 is a model row on the
// retention field of the audit-record store (B-F6, patch 13).

import type { EvidenceRule, En50742RequirementId } from "../models/compliance-types";

const RULES = [
  { id: "en-6-257", type: "C", targets: [] },
  { id: "en-8.2-458", type: "C", targets: [] },
  { id: "en-8.3-471", type: "C", targets: [] },
  { id: "en-8.3-473", type: "C", targets: [] },
  // the scope of O17 takes every relevant element whole (8.3/479–480)
  { id: "en-8.3-479", type: "A", targets: [], external: { kind: "project", check: "safety-scope" } },
  {
    // B-F6: the store holding the audit records (CR 2.8) keeps them ≥ 5 years
    id: "en-8.5-487",
    type: "B",
    quantifier: "any",
    withoutTarget: { status: "gap", reason: "noAuditRecordStore" },
    targets: [
      // the records must be kept somewhere: some store in scope holds audit
      // logs for ≥ 5 years — none (or a shorter one) is a gap a statement can
      // close (e.g. "the records are kept in the plant's log server")
      {
        elementTypes: ["DataStore"],
        satisfiedIfAll: [
          { property: "storedDataTypes", in: ["audit_logs"] },
          { property: "auditRecordRetention", in: ["at_least_5_years", "unlimited"] },
        ],
      },
    ],
    checklist: ["the records survive a restart and a replacement of the component"],
  },
] as const satisfies readonly EvidenceRule<En50742RequirementId>[];

export const EN50742_B_RULES: readonly EvidenceRule<En50742RequirementId>[] = RULES;
