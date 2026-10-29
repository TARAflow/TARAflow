// ==================== DOES A MITIGATION FIT THIS INTERFACE? ====================
// Closed-loop review CL-1b (finding 6): catalog mitigations carry no interface
// type, so the debug-interface controls reached every Interface — WLAN was
// asked for debugProtection = fused_off and operationalState = hw_disabled.
// The applicability rule of the forms and the threat generator
// (interface-capability-registry) now gates the closed loop too.

import { isInterfaceControlKeyApplicable } from "../models/interface-capability-registry";

const CONTROLS = "implementedControls.";

interface EffectShape {
  targetType: string;
  property: string;
}

/**
 * A mitigation with an Interface control that is not applicable to this
 * interface's type is not about this interface: none of its Interface effects
 * apply here [design §3, D]. Mitigations without Interface controls fit.
 */
export function mitigationFitsInterface(
  effects: readonly EffectShape[] | undefined,
  interfaceProps: Record<string, unknown> | null | undefined,
): boolean {
  const type = interfaceProps?.type as string | undefined;
  return (effects ?? [])
    .filter((e) => e.targetType === "Interface" && e.property.startsWith(CONTROLS))
    .every((e) => isInterfaceControlKeyApplicable(type, e.property.slice(CONTROLS.length)));
}
