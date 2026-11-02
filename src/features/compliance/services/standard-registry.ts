// ==================== STANDARD REGISTRY ====================
// The standards the Compliance tab can evaluate (model coverage plan §2.1).
// A standard is data on the one evaluator: its edition, the regulation tags
// that show it and the kind of header. The project's regulation tags select
// every matching standard (K-1, supersedes D-3): with "IEC 62443" and
// "EN IEC 62443 (CRA)" both editions apply. The generic "CRA" tag selects
// none — products whose harmonised standard is not EN IEC 62443-4-2 carry it
// too (D-1).

import type { ProjectTags } from "shared";
import type { Edition, EditionId, StandardFamilyId } from "../models/compliance-types";
import { EDITION_2019 } from "../data/edition-iec-62443-4-2-2019";
import { EDITION_PRAA_2026 } from "../data/edition-en-iec-62443-4-2-praa-2026";

export const TAG_IEC_62443 = "IEC 62443";
export const TAG_EN_IEC_62443_CRA = "EN IEC 62443 (CRA)";

/** A standard the Compliance tab can evaluate — data only, no code of its own. */
export interface StandardModule {
  id: EditionId;
  /** Statements and the component are shared inside a family (D-31, K-6). */
  family: StandardFamilyId;
  /** Regulation tags that show the standard; any one suffices. */
  tags: readonly string[];
  edition: Edition;
  /** SL-T / SL-C per group, or a conformance summary (standards without levels). */
  header: "security-levels" | "conformance";
}

/** Registry order = sub-tab order: CRA edition first, then the classic edition. */
export const STANDARDS: readonly StandardModule[] = [
  {
    id: EDITION_PRAA_2026.id,
    family: EDITION_PRAA_2026.family,
    tags: [TAG_EN_IEC_62443_CRA],
    edition: EDITION_PRAA_2026,
    header: "security-levels",
  },
  {
    id: EDITION_2019.id,
    family: EDITION_2019.family,
    tags: [TAG_IEC_62443],
    edition: EDITION_2019,
    header: "security-levels",
  },
];

/** Every standard one of the project's regulation tags selects, in registry order. */
export function activeStandards(tags: Pick<ProjectTags, "regulation"> | null | undefined): readonly StandardModule[] {
  const regulation = tags?.regulation ?? [];
  return STANDARDS.filter((s) => s.tags.some((tag) => regulation.includes(tag)));
}

/**
 * The edition the tab and the report show until they show one sub-tab /
 * chapter per standard (CM-2, CM-9): the first active standard — with both
 * 62443 tags the CRA edition, as before.
 */
export function selectEdition(tags: Pick<ProjectTags, "regulation"> | null | undefined): Edition | null {
  return activeStandards(tags)[0]?.edition ?? null;
}
