// ==================== STANDARD REGISTRY ====================
// The standards the Compliance tab can evaluate (model coverage plan §2.1).
// A standard is data on the one evaluator: its edition, the regulation tags
// that show it and the kind of header. The project's regulation tags select
// every matching standard (K-1, supersedes D-3): with "IEC 62443" and
// "EN IEC 62443 (CRA)" both editions apply. The generic "CRA" tag selects
// none — products whose harmonised standard is not EN IEC 62443-4-2 carry it
// too (D-1). EN 50742 Approach A is shown by its tag and the aliases of the
// tag normaliser (model coverage plan §8.1).

import { isEn50742ApproachATag, type ProjectTags } from "shared";
import type { AnyEdition, EditionId, StandardFamilyId } from "../models/compliance-types";
import { EDITION_2019 } from "../data/edition-iec-62443-4-2-2019";
import { EDITION_PRAA_2026 } from "../data/edition-en-iec-62443-4-2-praa-2026";
import { EDITION_EN50742_A } from "../data/edition-en-50742-a";

export const TAG_IEC_62443 = "IEC 62443";
export const TAG_EN_IEC_62443_CRA = "EN IEC 62443 (CRA)";
export const TAG_EN_50742_A = "EN 50742 A";

/** A standard the Compliance tab can evaluate — data only, no code of its own. */
export interface StandardModule {
  id: EditionId;
  /** Statements and the component are shared inside a family (D-31, K-6). */
  family: StandardFamilyId;
  /** Sub-tab label — the standard's short name, not translated. */
  label: string;
  /** Regulation tags that show the standard; any one suffices. */
  tags: readonly string[];
  /** Spellings of the tags that show it too (normalised matching); absent = `tags` exactly. */
  matchesTag?: (tag: string) => boolean;
  edition: AnyEdition;
  /**
   * SL-T / SL-C per group; a conformance summary (standards without levels);
   * or the SRSL the risks derive per safety function with the summary (EN 50742 A).
   */
  header: StandardHeader;
}

export type StandardHeader = "security-levels" | "conformance" | "srsl";

/** Registry order = sub-tab order: CRA edition first, then the classic edition. */
export const STANDARDS: readonly StandardModule[] = [
  {
    id: EDITION_PRAA_2026.id,
    family: EDITION_PRAA_2026.family,
    label: "EN IEC 62443-4-2 (CRA)",
    tags: [TAG_EN_IEC_62443_CRA],
    edition: EDITION_PRAA_2026,
    header: "security-levels",
  },
  {
    id: EDITION_2019.id,
    family: EDITION_2019.family,
    label: "IEC 62443-4-2:2019",
    tags: [TAG_IEC_62443],
    edition: EDITION_2019,
    header: "security-levels",
  },
  {
    id: EDITION_EN50742_A.id,
    family: EDITION_EN50742_A.family,
    label: "EN 50742 A",
    tags: [TAG_EN_50742_A],
    matchesTag: isEn50742ApproachATag,
    edition: EDITION_EN50742_A,
    header: "srsl",
  },
];

/** Every standard one of the project's regulation tags selects, in registry order. */
export function activeStandards(tags: Pick<ProjectTags, "regulation"> | null | undefined): readonly StandardModule[] {
  const regulation = tags?.regulation ?? [];
  return STANDARDS.filter((s) => regulation.some((tag) => s.tags.includes(tag) || !!s.matchesTag?.(tag)));
}

/**
 * The edition the report shows until it has one chapter per standard
 * (CM-9): the first active standard — with both 62443 tags the CRA edition.
 */
export function selectEdition(tags: Pick<ProjectTags, "regulation"> | null | undefined): AnyEdition | null {
  return activeStandards(tags)[0]?.edition ?? null;
}
