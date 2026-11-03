// ==================== EDITION: EN 50742 APPROACH A ====================
// Rows of the Compliance sub-tab `en-50742-a` — prEN 50742:2025 (enquiry
// draft), Approach A. Source: en-50742-rq-coverage.md §9.2 (row id = clause
// and draft line of the requirement, group, type, evidence kind); the
// evidence rules are in en50742-a-rules.ts. The standard has no security
// levels: `minSl` is null on every row, the SRSL comes from the risk tab
// (coverage §9.3). Selected by the tag EN50742_A and its aliases (standard
// registry). Scope is the whole machine — the family has no component.

import type { Edition, EditionRow, En50742RequirementId } from "../models/compliance-types";

/** The row groups of Approach A, in display order (model coverage plan §8.1). */
export const EN50742_A_GROUPS = [
  "threat-assessment",
  "information-collection",
  "software-identification",
  "protection-measures",
  "information-for-use",
] as const;

export type En50742Group = (typeof EN50742_A_GROUPS)[number];

const row = (
  label: string,
  group: En50742Group,
  id: En50742RequirementId,
): EditionRow<En50742Group, En50742RequirementId> => ({
  label,
  group,
  minSl: null,
  requirementIds: [id],
  supportingMeasuresAllowed: false,
});

const ROWS: readonly EditionRow<En50742Group, En50742RequirementId>[] = [
  row("EN-4.3/217", "threat-assessment", "en-4.3-217"),
  row("EN-4.3/220", "threat-assessment", "en-4.3-220"),
  row("EN-4.3/238 + EN-7.2.1/272", "threat-assessment", "en-4.3-238"),
  row("EN-7.1/260", "threat-assessment", "en-7.1-260"),
  row("EN-7.4.2/334", "threat-assessment", "en-7.4.2-334"),
  row("EN-7.4.2/344", "threat-assessment", "en-7.4.2-344"),
  row("EN-7.3.1/281", "information-collection", "en-7.3.1-281"),
  row("EN-7.3.2/295–296", "information-collection", "en-7.3.2-295"),
  row("EN-7.3.3/304–311", "information-collection", "en-7.3.3-304"),
  row("EN-7.3.4/317–319", "information-collection", "en-7.3.4-317"),
  row("EN-7.3.5/321–322", "information-collection", "en-7.3.5-321"),
  row("EN-7.5/444–445", "software-identification", "en-7.5-444"),
  row("EN-7.4.3.1/347–349", "protection-measures", "en-7.4.3.1-347"),
  row("EN-7.4.3.2.1/356–360", "protection-measures", "en-7.4.3.2.1-356"),
  row("EN-7.4.3.3.1/370–374", "protection-measures", "en-7.4.3.3.1-370"),
  row("EN-7.4.3.4.1/380–386", "protection-measures", "en-7.4.3.4.1-380"),
  row("EN-7.4.3.4.2/392–396", "protection-measures", "en-7.4.3.4.2-392"),
  row("EN-7.4.3.4.3/402–406", "protection-measures", "en-7.4.3.4.3-402"),
  row("EN-7.4.3.4.4/412–421", "protection-measures", "en-7.4.3.4.4-412"),
  row("EN-7.4.3.4.5/426–430", "protection-measures", "en-7.4.3.4.5-426"),
  row("EN-7.4.3.5.1/438–441", "protection-measures", "en-7.4.3.5.1-438"),
  row("EN-9/491–496", "information-for-use", "en-9-491"),
  row("EN-4.3/229", "information-for-use", "en-4.3-229"),
];

export const EDITION_EN50742_A: Edition<En50742Group, En50742RequirementId> = {
  id: "en-50742-a",
  family: "en-50742",
  title: "prEN 50742:2025 Approach A (draft)",
  draft: true,
  ccsc2Label: "measures of the machine's environment",
  groups: EN50742_A_GROUPS,
  rows: ROWS,
};
