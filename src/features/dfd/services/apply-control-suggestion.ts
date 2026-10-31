// ==================== APPLY A CONTROL SUGGESTION ====================
// "Apply" in the DFD notification panel: sets the expected value of a closed-
// loop SHOULD on the element and records it (WAS, securityControlOwnership).
// Closed-loop review CL-1: the update goes into `properties` — where the forms,
// the generator and the closed loop read it (finding 9: it was spread onto the
// element itself, so Apply changed nothing visible) — and nested for
// "implementedControls.<key>" (finding 8).

import { controlValuePatch } from "shared/utils/control-value-semantics";
import type { SecurityControlRecord } from "../models/element-shared-types";

export function applyControlSuggestionUpdate(
  properties: Record<string, unknown> | undefined,
  property: string,
  value: unknown,
  source: { mitigationId?: string; riskId?: string; at: string },
): { properties: Record<string, unknown> } {
  const current = properties ?? {};
  const record: SecurityControlRecord = {
    property,
    value,
    setBy: "apply_suggestion",
    setAt: source.at,
    ...(source.mitigationId ? { mitigationId: source.mitigationId } : {}),
    ...(source.riskId ? { riskId: source.riskId } : {}),
  } as SecurityControlRecord;
  const ownership = ((current.securityControlOwnership as SecurityControlRecord[] | undefined) ?? []).filter(
    (r) => r.property !== property,
  );
  return {
    properties: {
      ...current,
      ...controlValuePatch(current, property, value),
      securityControlOwnership: [...ownership, record],
    },
  };
}
