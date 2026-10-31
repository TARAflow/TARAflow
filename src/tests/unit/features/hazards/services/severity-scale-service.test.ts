// src/tests/unit/features/hazards/services/severity-scale-service.test.ts
import { describe, it, expect } from "vitest";
import { defaultSeverityFor, resolveSeverityScale } from "features/hazards";

describe("resolveSeverityScale", () => {
  it("returns the safety scale for human targets, 'none' (S0) first (ISO plan 13 C)", () => {
    expect(resolveSeverityScale("human")).toEqual([
      "none",
      "reversible_minor",
      "reversible_major",
      "irreversible_minor",
      "irreversible_major",
      "fatal",
    ]);
  });

  it("returns the 4-level scale for environment", () => {
    expect(resolveSeverityScale("environment")).toEqual([
      "low",
      "medium",
      "high",
      "critical",
    ]);
  });

  it("returns the 4-level scale for infrastructure", () => {
    expect(resolveSeverityScale("infrastructure")).toEqual([
      "low",
      "medium",
      "high",
      "critical",
    ]);
  });

  it("a new edge starts with the lowest harm, never 'none' (S0)", () => {
    expect(defaultSeverityFor("human")).toBe("reversible_minor");
    expect(defaultSeverityFor("environment")).toBe("low");
    expect(defaultSeverityFor("infrastructure")).toBe("low");
  });
});
