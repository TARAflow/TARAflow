// app/services/compliance-statements-legacy.ts
//
// D-31: statements are stored per requirement (ComplianceData.statements by
// requirementKey). Files written during the 0.17 development stored them per
// edition and row label ({ [editionId]: { [label]: statement } }). On load
// they are folded into the new form: each label is resolved to its row's
// requirement key in its edition; where both editions held a statement for
// the same requirement, the newer one wins. Idempotent — data in the new
// form passes unchanged (same object).

import { EDITION_2019, EDITION_PRAA_2026, statementKeyOf, type Edition } from "features/compliance";
import type { ComplianceData, ComplianceStatement } from "shared";

const EDITIONS: Readonly<Record<string, Edition>> = {
  [EDITION_2019.id]: EDITION_2019,
  [EDITION_PRAA_2026.id]: EDITION_PRAA_2026,
};

const isStatement = (v: unknown): v is ComplianceStatement =>
  !!v && typeof v === "object" && typeof (v as ComplianceStatement).status === "string";

export function foldLegacyStatements(data: ComplianceData | undefined): ComplianceData | undefined {
  const stored = data?.statements as Record<string, unknown> | undefined;
  if (!stored || !Object.keys(stored).some((k) => k in EDITIONS && !isStatement(stored[k]))) return data;

  const folded: Record<string, ComplianceStatement> = {};
  const put = (key: string, statement: ComplianceStatement) => {
    const existing = folded[key];
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
  return { ...data, statements: folded };
}
