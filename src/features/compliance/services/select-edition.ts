// ==================== EDITION SELECTION ====================
// The project's regulation tags select the matrix (D-1, D-3): the classic
// edition for "IEC 62443", the CRA edition for "EN IEC 62443 (CRA)". Each
// tag alone selects its matrix; with both, the CRA edition applies (the
// stronger one). The generic "CRA" tag selects none — products whose
// harmonised standard is not EN IEC 62443-4-2 carry it too. The tag itself is
// added to the tag catalogue in IEC-2b.

import type { ProjectTags } from "shared";
import type { Edition } from "../models/compliance-types";
import { EDITION_2019 } from "../data/edition-iec-62443-4-2-2019";
import { EDITION_PRAA_2026 } from "../data/edition-en-iec-62443-4-2-praa-2026";

export const TAG_IEC_62443 = "IEC 62443";
export const TAG_EN_IEC_62443_CRA = "EN IEC 62443 (CRA)";

export function selectEdition(tags: Pick<ProjectTags, "regulation"> | null | undefined): Edition | null {
  const regulation = tags?.regulation ?? [];
  if (regulation.includes(TAG_EN_IEC_62443_CRA)) return EDITION_PRAA_2026;
  if (regulation.includes(TAG_IEC_62443)) return EDITION_2019;
  return null;
}
