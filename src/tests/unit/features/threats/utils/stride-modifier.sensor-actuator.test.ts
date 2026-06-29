// ==================== RC-3 — Sensor/Actuator Module-1 modifiers ====================
// Phase: per-element generation fix, Step 4.
//
// Problem: applyElementProperties (UnifiedStrategy) has no Sensor/Actuator case →
// they fall to `default` → base STRIDE with no property modulation, ignoring the
// hazard fields (safetyRelevant / physicalImpact / hazardSeverity).
//
// This suite is the SPEC for the new modifySensorStride / modifyActuatorStride
// functions. It will not compile until those exports exist (intended TDD red).
//
// Design contract (mirrors the existing modifiers):
//   - pure, no side effects
//   - never add a category outside the caller's base table (the generator still
//     intersects with base; modifiers only escalate/keep/skip within reason)
//   - safetyRelevant / physicalImpact present → ensure T and D are kept (safety
//     impact: tampering with a sensor reading or actuator command, and loss of
//     availability, both carry physical consequence)

import { describe, it, expect } from "vitest";
import {
  modifySensorStride,
  modifyActuatorStride,
} from "../../../../../features/threats/utils/stride-modifier";
import type { StrideCategory } from "shared";

const SENSOR_BASE: StrideCategory[] = ["T", "D"];
const ACTUATOR_BASE: StrideCategory[] = ["T", "D"];

const sortSet = (c: StrideCategory[]) => [...new Set(c)].sort();

describe("modifySensorStride (RC-3)", () => {
  it("returns the base table unchanged when no safety/hazard signal is present", () => {
    expect(sortSet(modifySensorStride(SENSOR_BASE, {}))).toEqual(["D", "T"]);
  });

  it("keeps T and D for a safety-relevant sensor", () => {
    const out = modifySensorStride(SENSOR_BASE, { safetyRelevant: true });
    expect(out).toContain("T");
    expect(out).toContain("D");
  });

  it("keeps T and D when a physical impact is declared", () => {
    const out = modifySensorStride(SENSOR_BASE, {
      physicalImpact: "irreversible_injury",
    });
    expect(out).toContain("T");
    expect(out).toContain("D");
  });

  it("never introduces a category outside the base table", () => {
    const out = modifySensorStride(SENSOR_BASE, {
      safetyRelevant: true,
      physicalImpact: "fatality",
    });
    for (const c of out) expect(SENSOR_BASE).toContain(c);
  });
});

describe("modifyActuatorStride (RC-3)", () => {
  it("returns the base table unchanged when no safety/hazard signal is present", () => {
    expect(sortSet(modifyActuatorStride(ACTUATOR_BASE, {}))).toEqual(["D", "T"]);
  });

  it("keeps T and D for a safety-relevant actuator (command tampering / loss)", () => {
    const out = modifyActuatorStride(ACTUATOR_BASE, { safetyRelevant: true });
    expect(out).toContain("T");
    expect(out).toContain("D");
  });

  it("never introduces a category outside the base table", () => {
    const out = modifyActuatorStride(ACTUATOR_BASE, {
      safetyRelevant: true,
      physicalImpact: "fatality",
    });
    for (const c of out) expect(ACTUATOR_BASE).toContain(c);
  });
});
