// ==================== INTERFACE CONTROL APPLICABILITY ====================
// A2 view-model + A3 clear-rule, both thin façades over the ONE rule engine:
// isControlApplicable (interface-type-registry, which itself delegates the
// four shared keys to src/shared/models/interface-capability-registry).
//
// Design invariants (from TARAflow-Interface-Refactor-Plan.md, Part A):
//   - "n/a" is NEVER a stored value. It is DERIVED here from the registry.
//     The stored implementedControls field carries a real value or undefined.
//   - Applicability is a function of (interfaceType × controlKey), not of the
//     stored value — so it stays correct across a type change, unlike a frozen
//     "n/a" string would.
//   - Single source of truth: this module adds NO applicability logic of its
//     own. It only aggregates isControlApplicable into an instance view and a
//     clear patch.

import type { InterfaceProperties,InterfaceType } from "./element-properties";
import {
  isControlApplicable,
  INTERFACE_CONTROL_KEYS,
  type InterfaceControlKey,
} from "./interface-type-registry";

// Each InterfaceControlKey is stored under the identically-named field inside
// implementedControls. Keep this list in sync with INTERFACE_CONTROL_KEYS —
// the test enforces it.
type ImplementedControls = NonNullable<
  InterfaceProperties["implementedControls"]
>;

/**
 * Applicability state per control key, for a given interface instance.
 *
 * Only TWO states — deliberately. The stored value's set/unset distinction is
 * NOT modelled here, because `undefined` and `"none"` are semantically
 * identical for risk assessment: both mean "no measure / worst case". They
 * differ only in provenance (undefined = freshly created, not yet touched;
 * "none" = analyst deliberately chose no measure), and that provenance has no
 * downstream consequence — the threat generator treats both as the worst-case
 * gap, the validator raises nothing on security controls (unset == none is a
 * valid statement, not a gap), and the form shows the field either way.
 *
 * The only distinction with a real consequence is applicable vs not-applicable
 * (show the field / emit threats, or not).
 *
 *   - "applicable":     meaningful for this interface type → show + assess
 *   - "not-applicable": n/a for this type → hide, no threat, never stored
 */
export type ControlApplicabilityState = "applicable" | "not-applicable";

export interface ApplicableControlsView {
  byKey: Record<InterfaceControlKey, ControlApplicabilityState>;
  applicable: InterfaceControlKey[];
  notApplicable: InterfaceControlKey[];
}

/**
 * Derive the applicability view for one interface instance. Pure function of
 * `type` — the stored values are irrelevant to applicability (that is a
 * function of type × control alone). Nothing persisted, no side effects.
 *
 * A2 acceptance:
 *   touchscreen → applicable = { physicalAccessProtection };
 *                 not-applicable = { signalProtection, debugProtection,
 *                                    linkAuthentication, ... }
 *   wifi        → applicable = { linkAuthentication };
 *                 not-applicable = { physicalAccessProtection,
 *                                    signalProtection, debugProtection, ... }
 */
export function getApplicableControls(
  type: InterfaceType,
): ApplicableControlsView {
  const byKey = {} as Record<InterfaceControlKey, ControlApplicabilityState>;
  const applicable: InterfaceControlKey[] = [];
  const notApplicable: InterfaceControlKey[] = [];

  for (const key of INTERFACE_CONTROL_KEYS) {
    if (isControlApplicable(type, key)) {
      byKey[key] = "applicable";
      applicable.push(key);
    } else {
      byKey[key] = "not-applicable";
      notApplicable.push(key);
    }
  }

  return { byKey, applicable, notApplicable };
}

/**
 * A3 clear-rule. When an interface's `type` changes, any implementedControls
 * value for a control that is NO LONGER applicable under the new type must be
 * cleared to undefined (NOT set to "n/a" — n/a is derived, never stored).
 *
 * Returns a partial implementedControls patch mapping each now-inapplicable
 * key to undefined. Apply it in the form's type-change handler, merged over the
 * existing implementedControls, e.g.:
 *
 *   handlePropertyChange("implementedControls", {
 *     ...props.implementedControls,
 *     ...buildInterfaceControlClearPatch(newType, props.implementedControls),
 *   });
 *
 * Fields that become applicable again after a later type change are simply
 * left undefined by this patch. undefined == "none" == worst case, so the
 * threat generator already treats the field correctly; the analyst can set a
 * real protective value when they choose. There is never a stored "n/a" to undo.
 */
export function buildInterfaceControlClearPatch(
  newType: InterfaceType,
  implementedControls: Partial<ImplementedControls> | undefined | null,
): Partial<Record<InterfaceControlKey, undefined>> {
  const patch: Partial<Record<InterfaceControlKey, undefined>> = {};
  if (!implementedControls) return patch;

  for (const key of INTERFACE_CONTROL_KEYS) {
    const stored = implementedControls[key as keyof ImplementedControls];
    const hasValue = stored !== undefined && stored !== null;
    if (hasValue && !isControlApplicable(newType, key)) {
      patch[key] = undefined; // clear — the control is n/a under newType
    }
  }
  return patch;
}