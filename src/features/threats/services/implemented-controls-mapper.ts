// ==================== IMPLEMENTED CONTROLS MAPPER ====================
// Inspects element properties and returns MitigationDraft entries with
// alreadyImplemented: true for security controls already set on the element.
//
// These hints are merged with the template's proposedMitigations at
// threat-generation time (no duplicates — merge by id).
//
// Close-loop mechanism:
//   implementedByProperty + implementedByValue enable drift detection:
//   if the property reverts to "none" on next threat sync, the flag resets.
//
// Risk treatment implication: Reduce — threat still exists (residual risk),
// but the control is already in place. Distinct from Eliminate (no threat).

import type { StrideCategory } from "shared";
import type { MitigationDraft } from "../models/threat-types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function mark(
  id: string,
  property: string,
  value: string,
): MitigationDraft {
  return {
    id,
    alreadyImplemented: true,
    implementedByProperty: property,
    implementedByValue: value,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns MitigationDraft entries that are already implemented based on
 * the element's security control properties.
 *
 * Merge with template mitigations using mergeMitigationHints():
 *   - Matching id: marks the existing entry as alreadyImplemented
 *   - No match: appends as an additional already-implemented hint
 */
export function getImplementedMitigationHints(
  elementType: string,
  props: Record<string, unknown> | null,
  strideCategory: StrideCategory,
): MitigationDraft[] {
  if (!props) return [];
  const hints: MitigationDraft[] = [];

  // ── Interface / PhysicalInterface ─────────────────────────────────────────

  if (elementType === "Interface" || elementType === "PhysicalInterface") {
    const controls = props["implementedControls"] as
      | Record<string, unknown>
      | undefined;

    if (controls) {
      const lac = controls["logicalAccessControl"] as string | undefined;
      if (lac && lac !== "none") {
        if (strideCategory === "S") {
          hints.push(mark("M-S-001", "implementedControls.logicalAccessControl", lac));
          // Certificate, hardware_token, mfa → also marks stronger auth mitigation
          if (["certificate", "hardware_token", "mfa"].includes(lac)) {
            hints.push(mark("M-S-002", "implementedControls.logicalAccessControl", lac));
          }
        }
      }

      const dbg = controls["debugProtection"] as string | undefined;
      if (dbg && dbg !== "none") {
        if (["T", "E"].includes(strideCategory)) {
          hints.push(mark("M-CB-T-001", "implementedControls.debugProtection", dbg));
        }
        // readout_protection blocks flash dump → reduces I
        if (dbg === "readout_protection" && strideCategory === "I") {
          hints.push(mark("M-CB-I-001", "implementedControls.debugProtection", dbg));
        }
      }

      const pap = controls["physicalAccessProtection"] as string | undefined;
      if (pap && pap !== "none" && ["T", "E"].includes(strideCategory)) {
        hints.push(mark("M-IF-T-001", "implementedControls.physicalAccessProtection", pap));
      }

      const abuse = controls["abuseProtection"] as string | undefined;
      if (abuse && abuse !== "none") {
        if (strideCategory === "D") {
          hints.push(mark("M-D-001", "implementedControls.abuseProtection", abuse));
        }
        // lockout reduces S (brute-force spoofing)
        if (strideCategory === "S" && abuse === "lockout") {
          hints.push(mark("M-S-001", "implementedControls.abuseProtection", abuse));
        }
      }

      const sig = controls["signalProtection"] as string | undefined;
      if (sig && sig !== "none" && strideCategory === "I") {
        hints.push(mark("M-IF-I-001", "implementedControls.signalProtection", sig));
        // fiber_optic and isolated eliminate galvanic tap entirely
        if (["fiber_optic", "isolated"].includes(sig)) {
          hints.push(mark("M-IF-I-002", "implementedControls.signalProtection", sig));
        }
      }
    }

    // sw_disabled / hw_disabled reduce S, T, E (interface is off but reversible)
    const opState = props["operationalState"] as string | undefined;
    if (
      (opState === "sw_disabled" || opState === "hw_disabled") &&
      ["S", "T", "E"].includes(strideCategory)
    ) {
      hints.push(mark("M-IF-E-001", "operationalState", opState));
    }
  }

  // ── Process / Multiprocess ────────────────────────────────────────────────

  if (elementType === "Process" || elementType === "Multiprocess") {
    const mp = props["malwareProtection"] as string | undefined;
    if (mp && mp !== "none") {
      if (strideCategory === "E") {
        hints.push(mark("M-E-001", "malwareProtection", mp));
        if (["application_whitelist", "code_signing"].includes(mp)) {
          hints.push(mark("M-E-002", "malwareProtection", mp));
        }
      }
      if (strideCategory === "T") {
        hints.push(mark("M-T-001", "malwareProtection", mp));
      }
    }
  }

  // ── DataFlow ──────────────────────────────────────────────────────────────

  if (elementType === "DataFlow") {
    const ppp = props["physicalPathProtection"] as string | undefined;
    if (ppp && ppp !== "none") {
      if (strideCategory === "T") {
        hints.push(mark("M-T-001", "physicalPathProtection", ppp));
      }
      if (strideCategory === "D") {
        hints.push(mark("M-D-001", "physicalPathProtection", ppp));
      }
    }
  }

  return hints;
}

/**
 * Merges template mitigations with already-implemented hints.
 *
 * For each hint:
 *   - Matching id found in template list → marks it as alreadyImplemented
 *   - No match → appends as additional already-implemented entry
 *
 * This ensures analysts always see the full picture:
 *   - Template mitigations (recommended + already done)
 *   - Any extra controls implemented that the template didn't suggest
 */
export function mergeMitigationHints(
  templateMitigations: MitigationDraft[],
  hints: MitigationDraft[],
): MitigationDraft[] {
  if (hints.length === 0) return templateMitigations;

  const result = [...templateMitigations];
  for (const hint of hints) {
    const existing = result.find((m) => m.id === hint.id);
    if (existing) {
      // Mark the template mitigation as already implemented
      existing.alreadyImplemented = hint.alreadyImplemented;
      existing.implementedByProperty = hint.implementedByProperty;
      existing.implementedByValue = hint.implementedByValue;
    } else {
      // Append as additional hint — control exists but wasn't in template
      result.push(hint);
    }
  }
  return result;
}