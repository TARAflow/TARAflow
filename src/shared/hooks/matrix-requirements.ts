// shared/hooks/matrix-requirements.ts
//
// IEC-8b (iec-62443-4-2-cra-coverage.md): the IEC 62443-4-2 requirements a
// project mitigation (M-C-nnn) can reference. The threats feature must not
// import the compliance feature, so the app layer provides the list — only
// while the project's tags select a 62443 edition; without a provider the
// mitigation form shows no requirement field.

import { createContext, useContext } from "react";

export interface MatrixRequirementOption {
  /** Unqualified id as in the catalog's `iec62443` references, e.g. "cr-7.8". */
  id: string;
  /** "CR 7.8 — Control system component inventory" */
  label: string;
}

export interface MatrixRequirements {
  options: readonly MatrixRequirementOption[];
  /** Requirements the DFD effects of a mitigation already meet (D-29) — shown, not stored. */
  derivedFrom: (effects: readonly { targetType: string; property: string; expectedValue: unknown }[]) => string[];
}

export const MatrixRequirementsContext = createContext<MatrixRequirements | undefined>(undefined);

export const useMatrixRequirements = (): MatrixRequirements | undefined => useContext(MatrixRequirementsContext);
