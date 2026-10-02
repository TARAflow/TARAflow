// The threat phase's status for the phase tabs and the project progress.
//
// Before, every threat update reported phaseStatus `[]` — it replaced the
// whole project map (General, DFD, Assets … all lost) and was written to the
// project file as an empty array.
//
//   no threat in either table          → not-started
//   some threat not yet rated          → in-progress
//   every threat rated (relevance set) → complete

import type { PhaseStatus, PhaseStatusMap } from "shared";
import { PHASE_STATUS_KEY } from "shared";
import type { ThreatData } from "../models/threat-types";

export function threatPhaseStatus(data: ThreatData | null | undefined): PhaseStatus {
  const threats = [
    ...(data?.perElementTables ?? []),
    ...(data?.perInteractionTables ?? []),
  ].flatMap((t) => t.threats ?? []);
  if (threats.length === 0) return "not-started";
  return threats.every((t) => t.relevance && t.relevance !== "unrated") ? "complete" : "in-progress";
}

/** The project's map with only the threat phase updated. */
export function withThreatPhaseStatus(
  current: PhaseStatusMap,
  data: ThreatData | null | undefined,
): PhaseStatusMap {
  return { ...current, [PHASE_STATUS_KEY.threats]: threatPhaseStatus(data) };
}
