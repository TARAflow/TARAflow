import type { PhaseStatus } from "shared";

/**
 * Migrate schema version 1 -> 2.
 * Inserts the Hazard phase at position 1: every existing phase id >= 1 shifts up
 * by one (DFD 1->2 ... Integration 8->9), a new Hazard phase (id 1) is added as
 * "not-started", and the Project.hazards slot is introduced (default null).
 */
export function migrate_1_to_2(data: any): any {
  const oldStatus = data.phaseStatus ?? {};
  const newStatus: Record<number, PhaseStatus> = {
    0: oldStatus[0] ?? "not-started", // General (unchanged)
    1: "not-started", //                Hazard (new)
  };
  for (let oldId = 1; oldId <= 8; oldId++) {
    newStatus[oldId + 1] = oldStatus[oldId] ?? "not-started";
  }

  const oldCurrent = data.currentPhase ?? 0;
  const newCurrent = oldCurrent >= 1 ? oldCurrent + 1 : 0; // General stays 0

  return {
    ...data,
    currentPhase: newCurrent,
    phaseStatus: newStatus,
    hazards: data.hazards ?? null,
    schemaVersion: 2,
  };
}