// src/tests/unit/features/hazards/services/severity-scale-service.test.ts
import { describe, it, expect } from "vitest";
import { resolveSeverityScale } from "features/hazards";

describe("resolveSeverityScale", () => {
  it("returns the safety scale for human targets (excludes 'none')", () => {
    expect(resolveSeverityScale("human")).toEqual([
      "reversible_injury",
      "irreversible_injury",
      "fatality",
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
});
