// src/tests/unit/features/risks/services/models/risk-assessment-types.test.ts
import { describe, it, expect } from "vitest";
import type { ThreatReference, MitigationDraftRef } from "shared";
import {
  createEmptyRisk,
  createDefaultRiskData,
} from "features/risks/models/risk-assessment-types";

// Baut eine valide Configuration ohne deren Shape zu kennen (file-driven).
const config = () => createDefaultRiskData().configuration;

function makeThreatRef(
  overrides: Partial<ThreatReference> = {},
): ThreatReference {
  return {
    id: "T-1",
    displayId: "T-1",
    strideCategory: "S",
    threatDescription: "spoofing the sensor",
    attackDescription: "root > forge identity > read",
    sourceStrideMethod: "attack-path",
    relevance: "unrated",
    proposedMitigations: [],
    proposedVerifications: [],
    trustBoundaryId: null,
    trustBoundaryName: null,
    ...overrides,
  };
}

describe("ThreatReference merge — shared is the single definition", () => {
  it("accepts a shared ThreatReference and carries identity through unchanged", () => {
    const ref = makeThreatRef();
    const risk = createEmptyRisk(ref, config());

    expect(risk.threatId).toBe(ref.id);
    expect(risk.strideCategory).toBe(ref.strideCategory);
    expect(risk.sourceStrideMethod).toBe(ref.sourceStrideMethod);
    expect(risk.threatRelevance).toBe(ref.relevance);
  });

  it("initialImpact is inert today: present or absent yields an identical Risk", () => {
    const strip = <T extends { created: string; lastModified: string }>(
      r: T,
    ) => ({
      ...r,
      created: "",
      lastModified: "",
    });

    const withImpact = createEmptyRisk(
      makeThreatRef({ id: "T-2", initialImpact: "high" }),
      config(),
    );
    const withoutImpact = createEmptyRisk(
      makeThreatRef({ id: "T-2" }),
      config(),
    );

    // Kein Risk-Feld leitet sich (noch) aus initialImpact ab. Wenn Phase 6 das
    // Impact-Prefill verdrahtet, ist DIESER Test der, der bewusst angepasst
    // werden muss — nicht still.
    expect(strip(withImpact)).toEqual(strip(withoutImpact));
    // Das Feld leakt nicht auf den Risk (createEmptyRisk spreadet threatRef nicht).
    expect("initialImpact" in withImpact).toBe(false);
  });

  it("a ThreatReference without initialImpact stays valid (back-compat)", () => {
    const m: MitigationDraftRef = { id: "M-1" };
    const risk = createEmptyRisk(
      makeThreatRef({ proposedMitigations: [m] }),
      config(),
    );
    expect(risk.proposedMitigations).toEqual([m]);
  });
});
