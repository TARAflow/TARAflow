// ==================== THREAT ELIMINATION FILTER ====================
// Returns true when an element property value makes a threat scenario
// physically or logically impossible — no threat should be generated.
//
// Risk treatment implication: Eliminate (not Reduce / Accept).
// Conservative by design: only cover unambiguous cases.
// When in doubt, generate the threat and let the analyst decide.
//
// Distinct from "reduce": elimination means no residual risk exists
// at the model level (e.g. OTP fuse blown = no debug path at all).

import type { StrideCategory } from "shared";

export function shouldEliminateThreat(
  elementType: string,
  props: Record<string, unknown>,
  strideCategory: StrideCategory,
): boolean {
  // ── Interface / PhysicalInterface ─────────────────────────────────────────

  if (elementType === "Interface" || elementType === "PhysicalInterface") {
    // permanent_disabled: OTP fuse blown, pad unpopulated, or epoxy-filled.
    // No attack path exists — threat eliminated for all STRIDE categories.
    if (props["operationalState"] === "permanent_disabled") return true;

    const controls = props["implementedControls"] as
      | Record<string, unknown>
      | undefined;

    if (controls) {
      // fused_off: equivalent to permanent_disabled for the debug interface.
      // OTP fuse blown or pad removed — no physical connection possible.
      if (controls["debugProtection"] === "fused_off")
        return ["T", "I", "E"].includes(strideCategory);

      // sealed: destructive access only (potting, welding).
      // Physical tampering and privilege escalation path eliminated.
      if (controls["physicalAccessProtection"] === "sealed")
        return ["T", "E"].includes(strideCategory);

      // fiber_optic: galvanic eavesdropping physically impossible.
      // Optical medium eliminates passive electrical tap entirely.
      if (controls["signalProtection"] === "fiber_optic")
        return strideCategory === "I";
    }

    // enabled_read_only: no input path exists.
    // Spoofing (forged sender) and Elevation via command injection eliminated.
    // Information Disclosure remains active (output is still readable).
    if (props["operationalState"] === "enabled_read_only")
      return ["S", "E"].includes(strideCategory);
  }

  // ── DataFlow ──────────────────────────────────────────────────────────────

  if (elementType === "DataFlow") {
    // buried: underground cable — excavation required for physical access.
    // Out of scope for standard TARA threat model.
    if (
      props["physicalPathProtection"] === "buried" &&
      strideCategory === "T"
    )
      return true;
  }

  return false;
}