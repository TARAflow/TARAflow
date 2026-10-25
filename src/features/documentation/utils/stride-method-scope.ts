// ==================== STRIDE METHODS IN THE REPORT ====================
// A regulation preset may disable a STRIDE threat generator (ISO/SAE 21434:
// per-interaction). The Threats tab hides that method; the report must too —
// a project converted to the preset can still carry threats of the method,
// and they are not part of its analysis.

// Deep paths: the generation path imports no barrel (depcruise-doc).
import { getDisabledThreatGenerators } from "../../../shared/models/regulation-preset";
import { regulationPresetFromTags } from "../../../shared/services/tag-validator";
import type { ProjectTags } from "../../../shared/models/project-tags";
import type { StrideMethod } from "../../../shared/models/common-types";

/** Whether the project's preset switches this STRIDE method off. */
export function isStrideMethodDisabled(tags: ProjectTags | undefined, method: StrideMethod): boolean {
  if (!tags) return false;
  return getDisabledThreatGenerators(regulationPresetFromTags(tags)).includes(method);
}
