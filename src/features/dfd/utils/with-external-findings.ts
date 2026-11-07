// ==================== EXTERNAL FINDINGS ====================
// The DFD's validation plus findings of other layers (multi-project TARA:
// imported components, design v3 §8.1), shown in the toolbar chip and the
// notification panel. External errors make the DFD invalid; completeness
// and the scenario stay the DFD's own. Pure.

import type { ValidationFinding } from "../models/dfd-types";
import type { ValidationResult } from "../services/dfd-validator";

export interface ExternalFindings {
  errors: ValidationFinding[];
  warnings: ValidationFinding[];
  infos: ValidationFinding[];
}

export function withExternalFindings(
  own: ValidationResult | null,
  external: ExternalFindings | undefined,
): ValidationResult | null {
  if (!external || external.errors.length + external.warnings.length + external.infos.length === 0) return own;
  const base: ValidationResult = own ?? { isValid: true, isComplete: true, errors: [], warnings: [], infos: [], scenario: null };
  return {
    ...base,
    isValid: base.isValid && external.errors.length === 0,
    errors: [...base.errors, ...external.errors],
    warnings: [...base.warnings, ...external.warnings],
    infos: [...(base.infos ?? []), ...external.infos],
  };
}
