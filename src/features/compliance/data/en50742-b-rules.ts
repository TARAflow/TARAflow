// ==================== EVIDENCE RULES: EN 50742 APPROACH B ====================
// The rules of the EN rows Approach B adds (en-50742-rq-coverage.md §6.2).
// The IEC 62443-4-2 rows of Table 4 use the 2019 rules (evidence-rules.ts);
// the common clauses and 8.4 (= 7.5) use the Approach A rules.
//
// 8.3/473 (CCSC 2) and 8.3/479 (mixed components in full) become checks of
// the evaluation with the safety-path scope; 8.5 becomes a model row with
// the retention field of the audit-record store (B-F6). Until then they are
// statements (type C) — the sub-tab is not switched on before (roadmap 0.20).

import type { EvidenceRule, En50742RequirementId } from "../models/compliance-types";

const RULES = [
  { id: "en-6-257", type: "C", targets: [] },
  { id: "en-8.2-458", type: "C", targets: [] },
  { id: "en-8.3-471", type: "C", targets: [] },
  { id: "en-8.3-473", type: "C", targets: [] },
  { id: "en-8.3-479", type: "C", targets: [] },
  { id: "en-8.5-487", type: "C", targets: [] },
] as const satisfies readonly EvidenceRule<En50742RequirementId>[];

export const EN50742_B_RULES: readonly EvidenceRule<En50742RequirementId>[] = RULES;
