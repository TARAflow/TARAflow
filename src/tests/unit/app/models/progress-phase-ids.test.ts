// Overall progress (General tab): the phases that count. Hazard only for a
// safety-relevant project; Attack Tree only when the regulation requires
// attack trees (ISO/SAE 21434) — an empty attack tree phase kept a finished
// project at 86 % (Smoke Detector, standard preset).
import { describe, it, expect } from "vitest";
import { PhaseId, getProgressPhaseIds } from "app/models/phase-types";

describe("getProgressPhaseIds", () => {
  it("standard: without Hazard and Attack Tree", () => {
    expect(getProgressPhaseIds(false)).toEqual([PhaseId.General, PhaseId.DFD, PhaseId.Assets, PhaseId.Threats, PhaseId.Risk]);
  });

  it("ISO/SAE 21434: Attack Tree counts", () => {
    expect(getProgressPhaseIds(false, true)).toContain(PhaseId.AttackTree);
  });

  it("safety-relevant: Hazard counts", () => {
    expect(getProgressPhaseIds(true)).toContain(PhaseId.Hazard);
    expect(getProgressPhaseIds(true)).not.toContain(PhaseId.AttackTree);
  });
});
