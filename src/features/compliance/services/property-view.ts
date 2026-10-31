// ==================== PROPERTY VIEW ====================
// Builds the evaluator's view of the model from the DFD analysis view
// (iec-62443-4-2-cra-coverage.md §9.4, D-24). Plain shapes only — the app
// layer passes the analysis view of the dfd feature, the compliance feature
// never imports it.
//
//   elements  the leaves the threat generation sees, PLUS the decomposed
//             multiprocesses: they are no leaves, but carry the properties of
//             the system as a whole (updateMechanism, backupMechanism,
//             remoteAccessEnabled, systemClass, …). Without them a leveled
//             DFD would make every Multiprocess rule n/a (D-12).
//   flows     every drawn flow with its resolved endpoints, excluded ones
//             included (`validationConnections`): excludeFromThreatGen says
//             nothing about who accesses the component (D-24).

import type { PropertyView, ViewElement, ViewFlow } from "../models/evaluation-types";

export interface PropertyViewSource {
  /** Elements of the analysis view (leaves of the effective model). */
  analysisElements: readonly ViewElement[];
  /** Every logical element of the DFD (all pages). */
  allElements: readonly ViewElement[];
  /** Every drawn flow with resolved endpoints (analysis view `validationConnections`). */
  flows: readonly ViewFlow[];
  fallbackContained?: ReadonlySet<string>;
}

export function buildPropertyView(source: PropertyViewSource): PropertyView {
  const ids = new Set(source.analysisElements.map((e) => e.id));
  const decomposed = source.allElements.filter((e) => e.type === "Multiprocess" && !ids.has(e.id));
  return {
    elements: [...source.analysisElements, ...decomposed],
    flows: source.flows,
    fallbackContained: source.fallbackContained,
  };
}
