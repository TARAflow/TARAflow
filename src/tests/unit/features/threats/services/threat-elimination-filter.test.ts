// ==================== Guard — threat elimination filter (per-element) ====================
// Not a fix itself, but a regression pin so the RC-2/RC-3 work cannot silently
// change which threats the elimination filter removes. Mirrors the documented
// rules in threat-elimination-filter.ts.

import { describe, it, expect } from "vitest";
import { shouldEliminateThreat } from "../../../../../features/threats/services/threat-elimination-filter";
import type { StrideCategory } from "shared";

const ALL: StrideCategory[] = ["S", "T", "R", "I", "D", "E"];
const eliminated = (
  type: string,
  props: Record<string, unknown>,
): StrideCategory[] => ALL.filter((c) => shouldEliminateThreat(type, props, c));

describe("shouldEliminateThreat — Interface / PhysicalInterface", () => {
  it("permanent_disabled eliminates ALL categories (no attack path)", () => {
    expect(eliminated("Interface", { operationalState: "permanent_disabled" })).toEqual(ALL);
  });

  it("debugProtection fused_off eliminates T, I, E only", () => {
    expect(
      eliminated("Interface", { implementedControls: { debugProtection: "fused_off" } }),
    ).toEqual(["T", "I", "E"]);
  });

  it("physicalAccessProtection sealed eliminates T, E only", () => {
    expect(
      eliminated("Interface", { implementedControls: { physicalAccessProtection: "sealed" } }),
    ).toEqual(["T", "E"]);
  });

  it("signalProtection fiber_optic eliminates I only", () => {
    expect(
      eliminated("Interface", { implementedControls: { signalProtection: "fiber_optic" } }),
    ).toEqual(["I"]);
  });

  it("enabled_read_only eliminates S and E (no input path)", () => {
    expect(eliminated("Interface", { operationalState: "enabled_read_only" })).toEqual(["S", "E"]);
  });
});

describe("shouldEliminateThreat — ChipBoundary / DataFlow", () => {
  it("certified sideChannelProtection eliminates I only", () => {
    expect(eliminated("ChipBoundary", { sideChannelProtection: "certified" })).toEqual(["I"]);
  });

  it("buried DataFlow eliminates T only", () => {
    expect(eliminated("DataFlow", { physicalPathProtection: "buried" })).toEqual(["T"]);
  });
});

describe("shouldEliminateThreat — Sensor / Actuator are never eliminated (RC-2/RC-3 guard)", () => {
  it("does not eliminate any category for Sensor/Actuator regardless of props", () => {
    expect(eliminated("Sensor", { safetyRelevant: true })).toEqual([]);
    expect(eliminated("Actuator", { safetyRelevant: true })).toEqual([]);
  });
});
