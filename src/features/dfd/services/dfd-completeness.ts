// ==================== DFD COMPLETENESS ====================
// The DFD phase is complete when the last validation found no error and no
// warning and every element, flow and asset is described. The validation
// runs with every diagram save; a form edit (a description, a property)
// saves only the records — its completeness is derived here from the
// records and the last validation's findings, which a description does not
// change. Same rule as DFDService.determinePhaseStatus.

import type { PhaseStatus } from "shared";
import type { DFDData } from "../models/dfd-types";

const described = (records: readonly { description?: string }[]) =>
  records.filter((r) => !!r.description && r.description.trim().length > 0).length;

/** The DFD with fresh description counts and isComplete, and its phase status. */
export function withCompleteness(dfd: DFDData): { dfd: DFDData; phaseStatus: PhaseStatus | undefined } {
  const stats = dfd.stats
    ? {
        ...dfd.stats,
        describedElements: described(dfd.elements ?? []),
        describedConnections: described(dfd.connections ?? []),
      }
    : undefined;
  const validation = dfd.validation;
  if (!stats || !validation) return { dfd: stats ? { ...dfd, stats } : dfd, phaseStatus: undefined };

  const errors = validation.errors?.length ?? 0;
  const warnings = validation.warnings?.length ?? 0;
  const isComplete =
    errors === 0 &&
    warnings === 0 &&
    stats.describedElements === stats.totalElements &&
    stats.describedConnections === stats.dataFlows &&
    stats.describedAssets === stats.assets;
  const phaseStatus: PhaseStatus = isComplete ? "complete" : errors > 0 ? "incomplete" : "in-progress";
  return { dfd: { ...dfd, stats, validation: { ...validation, isComplete } }, phaseStatus };
}
