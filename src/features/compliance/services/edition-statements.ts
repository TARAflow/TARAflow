// ==================== STATEMENTS OF AN EDITION ====================
// Statements are stored per requirement (D-31, ComplianceData.statements by
// requirementKey); the evaluator and the tab work per row of an edition. A
// row finds the statement of its requirement ids — so a statement made with
// the CRA edition holds in the classic edition for the same requirement, and
// the other way round. Device rows (SAR / EDR / HDR / NDR 2.4 …) share their
// requirement and with it the statement.

import { requirementKey, type ComplianceStatement } from "shared";
import type { Edition, EditionRow } from "../models/compliance-types";

/** The storage key of a row's statement. */
export const statementKeyOf = (row: Pick<EditionRow, "requirementIds">): string => requirementKey(row.requirementIds);

/** Row label → statement, for the rows of `edition` that have one. */
export function editionStatements(
  edition: Edition,
  statements: Readonly<Record<string, ComplianceStatement>> | undefined,
): Record<string, ComplianceStatement> {
  if (!statements) return {};
  const out: Record<string, ComplianceStatement> = {};
  for (const row of edition.rows) {
    if (row.requirementIds.length === 0) continue;
    const statement = statements[statementKeyOf(row)];
    if (statement) out[row.label] = statement;
  }
  return out;
}
