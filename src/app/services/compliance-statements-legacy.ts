// app/services/compliance-statements-legacy.ts
//
// D-31: statements are stored per requirement (keyed by requirementKey).
// Files written during the 0.17 development stored them per edition and row
// label ({ [editionId]: { [label]: statement } }). migrate-12-to-13 folds
// those into the new form before it moves them into the family block: each
// label is resolved to its row's requirement key in its edition; where both
// editions held a statement for the same requirement, the newer one wins —
// the other is dropped, which the migration reports as an analysis change
// for that file (K-9). Statements in the new form pass unchanged (same
// object).

import { EDITION_2019, EDITION_PRAA_2026, statementKeyOf, type Edition } from "features/compliance";
import type { ComplianceStatement } from "shared";
import { canonicalStringify } from "./tcs-serialize";

const EDITIONS: Readonly<Record<string, Edition>> = {
  [EDITION_2019.id]: EDITION_2019,
  [EDITION_PRAA_2026.id]: EDITION_PRAA_2026,
};

const isStatement = (v: unknown): v is ComplianceStatement =>
  !!v && typeof v === "object" && typeof (v as ComplianceStatement).status === "string";

export interface FoldedStatements {
  statements: Record<string, ComplianceStatement> | undefined;
  /** Statements that lost to a newer, different one for the same requirement. */
  dropped: number;
}

export function foldLegacyStatements(stored: Readonly<Record<string, unknown>> | undefined): FoldedStatements {
  if (!stored || !Object.keys(stored).some((k) => k in EDITIONS && !isStatement(stored[k]))) {
    return { statements: stored as Record<string, ComplianceStatement> | undefined, dropped: 0 };
  }

  const folded: Record<string, ComplianceStatement> = {};
  let dropped = 0;
  const put = (key: string, statement: ComplianceStatement) => {
    const existing = folded[key];
    if (existing && canonicalStringify(existing) !== canonicalStringify(statement)) dropped++;
    if (!existing || (statement.date ?? "") > (existing.date ?? "")) folded[key] = statement;
  };
  for (const [key, value] of Object.entries(stored)) {
    const edition = EDITIONS[key];
    if (edition && !isStatement(value)) {
      const rows = new Map(edition.rows.map((r) => [r.label, r]));
      for (const [label, statement] of Object.entries((value ?? {}) as Record<string, unknown>)) {
        if (!isStatement(statement)) continue;
        const row = rows.get(label);
        put(row && row.requirementIds.length > 0 ? statementKeyOf(row) : label, statement);
      }
    } else if (isStatement(value)) {
      put(key, value);
    }
  }
  return { statements: folded, dropped };
}
