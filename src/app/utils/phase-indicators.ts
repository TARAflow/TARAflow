// ==================== PHASE INDICATORS ====================
// What the phase tabs and the Overview's phase progress show per phase —
// status, error and warning count — computed once, keyed by PhaseId (review
// 2026-10-30). Before, the Overview indexed its validation info by hand and
// showed the DFD's findings under Hazard (phase 1 is Hazard since the v2
// renumbering), and both read the DFD validation stored in the file: a file
// saved by an older version kept showing a finding the current validation
// no longer reports until the DFD was edited.
//
// The DFD part comes from validating the stored diagram now
// (dfdService.validateSavedState) — the same validation the DFD tab runs,
// against the canonical asset registry. The stored status stays for every
// other phase; the file is not changed (it follows with the next DFD save).

import type { PhaseStatus, PhaseStatusMap } from "shared";
import { missingGeneralFields } from "features/overview";
import type { ProjectInfoData } from "features/overview";
import { PhaseId } from "../models/phase-types";

export interface PhaseCounts {
  errors: number;
  warnings: number;
}

export interface PhaseIndicatorInput {
  phaseStatus: PhaseStatusMap;
  info: Pick<ProjectInfoData, "name" | "description" | "version" | "responsible" | "tags">;
  /** Validation of the stored diagram (validateSavedState); null = no diagram. */
  dfdValidation: { errors: readonly unknown[]; warnings: readonly unknown[] } | null;
  /** The DFD phase status that validation stands for (dfdService.phaseStatusOf). */
  dfdStatus?: PhaseStatus;
  /** Stored threats the current rules would no longer / additionally generate. */
  threatDrift?: { obsolete: number; added: number };
}

export interface PhaseIndicators {
  /** The stored phase status, the DFD's replaced by the current validation. */
  status: PhaseStatusMap;
  counts: Record<number, PhaseCounts>;
}

export function phaseIndicators(input: PhaseIndicatorInput): PhaseIndicators {
  const counts: Record<number, PhaseCounts> = {
    [PhaseId.General]: { errors: 0, warnings: missingGeneralFields(input.info).length },
    [PhaseId.Threats]: {
      errors: 0,
      warnings: (input.threatDrift?.obsolete ?? 0) + (input.threatDrift?.added ?? 0),
    },
  };
  let status = input.phaseStatus;
  if (input.dfdValidation) {
    counts[PhaseId.DFD] = {
      errors: input.dfdValidation.errors.length,
      warnings: input.dfdValidation.warnings.length,
    };
    if (input.dfdStatus) status = { ...status, [PhaseId.DFD]: input.dfdStatus };
  }
  return { status, counts };
}
