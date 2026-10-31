// src/tests/unit/shared/models/safety-severity.test.ts
//
// Canonical 5-level person-harm scale and the Safety Override tiers.

import { describe, it, expect } from "vitest";
import {
  SAFETY_SEVERITIES,
  isIrreversibleOrWorse,
  isOverrideSeverity,
  isSafetyCritical,
  iso26262SeverityClass,
  normalizeLegacySafetyImpact,
  safetySeverityToFactor,
  withSeverityClass,
  worstSafetySeverity,
} from "shared/models/safety-types";
import { deriveAggregatedImpact } from "features/assets/services/asset-physical-impact-deriver";

describe("canonical safety severity scale", () => {
  it("is ordered ascending with fatal separate from irreversible_major", () => {
    expect(SAFETY_SEVERITIES).toEqual([
      "reversible_minor",
      "reversible_major",
      "irreversible_minor",
      "irreversible_major",
      "fatal",
    ]);
  });

  it("maps onto the IEC 62061 Se1–Se4 factor", () => {
    expect(SAFETY_SEVERITIES.map(safetySeverityToFactor)).toEqual([1, 2, 3, 4, 4]);
  });

  it("picks the worst severity and ignores none/undefined", () => {
    expect(worstSafetySeverity(["none", undefined, "irreversible_minor", "reversible_major"]))
      .toBe("irreversible_minor");
    expect(worstSafetySeverity(["none", undefined])).toBeUndefined();
  });

  it("maps legacy values conservatively", () => {
    expect(normalizeLegacySafetyImpact("reversible_injury")).toBe("reversible_major");
    expect(normalizeLegacySafetyImpact("reversible_moderate")).toBe("reversible_major");
    expect(normalizeLegacySafetyImpact("irreversible_injury")).toBe("irreversible_major");
    expect(normalizeLegacySafetyImpact("fatality")).toBe("fatal");
    expect(normalizeLegacySafetyImpact("irreversible_minor")).toBe("irreversible_minor");
    expect(normalizeLegacySafetyImpact("bogus")).toBeUndefined();
  });

  it("classifies irreversible and override severities", () => {
    expect(isIrreversibleOrWorse("reversible_major")).toBe(false);
    expect(isIrreversibleOrWorse("irreversible_minor")).toBe(true);
    expect(isOverrideSeverity("irreversible_minor")).toBe(false);
    expect(isOverrideSeverity("irreversible_major")).toBe(true);
    expect(isOverrideSeverity("fatal")).toBe(true);
  });
});

describe("Safety Override Rule tiers", () => {
  const agg = (level: Parameters<typeof deriveAggregatedImpact>[0], direct: boolean) =>
    deriveAggregatedImpact(level, direct, "LOW");

  it("irreversible_major / fatal: CRITICAL direct, HIGH+ indirect", () => {
    expect(agg("fatal", true)).toBe("CRITICAL");
    expect(agg("irreversible_major", true)).toBe("CRITICAL");
    expect(agg("fatal", false)).toBe("HIGH+");
    expect(agg("irreversible_major", false)).toBe("HIGH+");
  });

  it("irreversible_minor: HIGH+ direct, HIGH indirect (no override)", () => {
    expect(agg("irreversible_minor", true)).toBe("HIGH+");
    expect(agg("irreversible_minor", false)).toBe("HIGH");
  });

  it("reversible: HIGH direct, MED+ indirect", () => {
    expect(agg("reversible_major", true)).toBe("HIGH");
    expect(agg("reversible_minor", false)).toBe("MED+");
  });

  it("isSafetyCritical requires direct AND an override severity", () => {
    expect(isSafetyCritical({ relevance: "direct", impact: "irreversible_major" })).toBe(true);
    expect(isSafetyCritical({ relevance: "direct", impact: "irreversible_minor" })).toBe(false);
    expect(isSafetyCritical({ relevance: "indirect", impact: "fatal" })).toBe(false);
  });
});

describe("ISO 26262 severity class (1H-S, RQ-15-06)", () => {
  it("maps the person scale onto S0–S3 by the S column", () => {
    expect(
      ["none", "reversible_minor", "reversible_major", "irreversible_minor", "irreversible_major", "fatal"].map(
        iso26262SeverityClass,
      ),
    ).toEqual(["S0", "S1", "S1", "S2", "S2", "S3"]);
  });

  it("pre-v9 names count as canonical; other scales have no class", () => {
    expect(iso26262SeverityClass("fatality")).toBe("S3");
    expect(iso26262SeverityClass("critical")).toBeUndefined();
    expect(iso26262SeverityClass("low")).toBeUndefined();
  });

  it("only under iso-21434 the label gets the class", () => {
    expect(withSeverityClass("irreversible_major", "Irreversible, major", "iso-21434")).toBe("S2 · Irreversible, major");
    expect(withSeverityClass("none", "None (no injury)", "iso-21434")).toBe("S0 · None (no injury)");
    expect(withSeverityClass("irreversible_major", "Irreversible, major", "default")).toBe("Irreversible, major");
    expect(withSeverityClass("critical", "Critical", "iso-21434")).toBe("Critical");
  });
});
