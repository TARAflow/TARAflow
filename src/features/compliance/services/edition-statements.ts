// ==================== STATEMENTS OF AN EDITION ====================
// Statements are stored per requirement (D-31, ComplianceData.statements by
// requirementKey); the evaluator and the tab work per row of an edition. A
// row finds the statement of its requirement ids — so a statement made with
// the CRA edition holds in the classic edition for the same requirement, and
// the other way round. Device rows (SAR / EDR / HDR / NDR 2.4 …) share their
// requirement and with it the statement.

import { requirementKey, type ComplianceStatement } from "shared";
import type { AnyEdition, AnyEditionRow, StandardFamilyId } from "../models/compliance-types";

/** The storage key of a row's statement. */
export const statementKeyOf = (row: Pick<AnyEditionRow, "requirementIds">): string => requirementKey(row.requirementIds);

/**
 * Row label → statement, for the rows of `edition` that have one. A row of
 * another family (EN 50742 B: the IEC 62443-4-2 rows, K-6) reads that
 * family's statements through `statementsOf`.
 */
export function editionStatements(
  edition: AnyEdition,
  statements: Readonly<Record<string, ComplianceStatement>> | undefined,
  statementsOf?: (family: StandardFamilyId) => Readonly<Record<string, ComplianceStatement>> | undefined,
): Record<string, ComplianceStatement> {
  const out: Record<string, ComplianceStatement> = {};
  for (const row of edition.rows) {
    if (row.requirementIds.length === 0) continue;
    const source = row.family && row.family !== edition.family ? statementsOf?.(row.family) : statements;
    const statement = source?.[statementKeyOf(row)];
    if (statement) out[row.label] = statement;
  }
  return out;
}
