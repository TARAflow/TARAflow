// ==================== REFINEMENT CANDIDATES ====================
// Leveled-DFD Phase 4b (leveled-dfd-multi-diagram-design.md §6.4): the flows
// a flow may refine, for the "Refines" choice in the data-flow form. Only for
// a leveled (multi-page) DFD — on a single page there is nothing to refine,
// and undefined hides the leveling section. Whether a choice is valid is the
// validator's job (BAL_REFINES_*), not the form's.

import type { DFDConnection } from "../models/dfd-types";
import type { RefinementCandidate } from "../components/forms/dataflow-description-form";
import { isLeveled } from "../services/build-dfd-graph";

export function refinementCandidatesOf(
  dfd:
    { xml?: string; connections?: readonly DFDConnection[] } | null | undefined,
): RefinementCandidate[] | undefined {
  if (!dfd || !isLeveled(dfd.xml)) return undefined;
  return [...(dfd.connections ?? [])]
    .map((c) => ({
      tfId: c.id,
      label: [c.displayId, c.name].filter(Boolean).join(" ") || c.id,
    }))
    .sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { numeric: true }),
    );
}
