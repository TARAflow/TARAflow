// ==================== GENERAL COMPLETENESS ====================
// The General phase: the project info the TARA needs. One rule for the
// warnings on the General tab and the phase status (before, the status was
// never derived — the General phase stayed "not started" for good).

import type { PhaseStatus } from "shared";
// Deep import: the app's commit chain runs this (tests mock the barrel).
import { flattenProjectTags } from "shared/models/project-tags";
import type { ProjectInfoData } from "../models/overview-types";

export type GeneralField = "name" | "description" | "version" | "responsible" | "tags";

const GENERAL_FIELDS: readonly GeneralField[] = ["name", "description", "version", "responsible", "tags"];

const filled = (s: string | undefined, min = 1) => (s ?? "").trim().length >= min;

/** The required General fields that are still missing. */
export function missingGeneralFields(
  info: Pick<ProjectInfoData, "name" | "description" | "version" | "responsible" | "tags">,
): GeneralField[] {
  const present: Record<GeneralField, boolean> = {
    name: filled(info.name, 3),
    description: filled(info.description),
    version: filled(info.version),
    responsible: filled(info.responsible),
    tags: !!info.tags && flattenProjectTags(info.tags).length > 0,
  };
  return GENERAL_FIELDS.filter((f) => !present[f]);
}

/** Complete when nothing is missing; not started when everything is. */
export function generalPhaseStatus(info: Parameters<typeof missingGeneralFields>[0]): PhaseStatus {
  const missing = missingGeneralFields(info).length;
  if (missing === 0) return "complete";
  return missing === GENERAL_FIELDS.length ? "not-started" : "in-progress";
}
