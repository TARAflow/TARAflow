// src/tests/unit/features/risks/services/risk-sync-service.en50742-el-prefill.test.ts
//
// §11.2 (Variante A) wiring: syncRisksFromThreats must apply
// applyExposureLevelToFactorRatings on BOTH paths — new risks created for
// newly-eligible threats, and existing risks re-synced on threat/DFD change.
// The adapter itself is unit-tested in en50742-risk-calculation.test.ts; this
// file only pins the wiring (call happens, non-destructively, on both paths,
// and is a no-op outside en-50742-a projects).
//
// Pure logic, no rendering.

import { describe, it, expect } from "vitest";
import { syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import {
  createDefaultRiskData,
  createEmptyRisk,
} from "features/risks/models/risk-assessment-types";
import type { RiskData } from "features/risks/models/risk-assessment-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import type { ThreatReference, DFDReference } from "shared";

// ── Fixtures ─────────────────────────────────────────────────────────────

function baseThreat(id: string): ThreatReference {
  return {
    id,
    strideCategory: "T",
    threatDescription: id,
    attackDescription: "",
    sourceStrideMethod: "per-element",
    relevance: "relevant",
    proposedMitigations: [],
    proposedVerifications: [],
    trustBoundaryId: null,
    trustBoundaryName: null,
    linkedAssetIds: [],
  };
}

/** Per-element threat, anchored on an Interface via linkedElement. */
function perElementThreat(id: string, elementId: string): ThreatReference {
  return {
    ...baseThreat(id),
    linkedElement: {
      elementId,
      elementName: "Auth Interface",
      elementType: "Interface",
      displayId: "IF-1",
    },
  };
}

/** Per-interaction threat, anchored on the crossing DataFlow via dataFlow.connectionId. */
function perInteractionThreat(id: string, connectionId: string): ThreatReference {
  return {
    ...baseThreat(id),
    sourceStrideMethod: "per-interaction",
    dataFlow: {
      connectionId,
      dataFlowId: connectionId,
      dataFlowName: "DF",
      sourceId: "p1",
      sourceName: "Source",
      sourceType: "Process",
      targetId: "p2",
      targetName: "Target",
      targetType: "Process",
    },
  };
}

/** DFD with a single Interface element carrying an already-derived EL. */
function dfdWithElementEL(elementId: string, exposureLevel: string): DFDReference {
  return {
    elements: [{ id: elementId, properties: { exposureLevel } }],
    connections: [],
  };
}

function dfdWithConnectionEL(connectionId: string, exposureLevel: string): DFDReference {
  return {
    elements: [],
    connections: [{ id: connectionId, properties: { exposureLevel } }],
  };
}

/** DEFAULT_CONFIGURATION with exposure_level enabled (en-50742-a-locked-like). */
function configWithELEnabled(base: RiskConfiguration): RiskConfiguration {
  return {
    ...base,
    activeFactors: base.activeFactors.map((f) =>
      f.factorId === "exposure_level" ? { ...f, enabled: true } : f,
    ),
  };
}

function riskDataWithConfig(configure: (c: RiskConfiguration) => RiskConfiguration): RiskData {
  const data = createDefaultRiskData();
  return { ...data, configuration: configure(data.configuration) };
}

function elRating(risk: {
  factorRatings: { factorId: string; value: number; source?: string }[];
}) {
  return risk.factorRatings.find((r) => r.factorId === "exposure_level");
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("syncRisksFromThreats — EN 50742 EL prefill wiring (§11.2, new risks)", () => {
  it("prefills exposure_level from the per-element anchor's Interface EL", () => {
    const riskData = riskDataWithConfig(configWithELEnabled);
    const dfd = dfdWithElementEL("if-1", "EL2");

    const result = syncRisksFromThreats(
      riskData,
      [perElementThreat("T-1", "if-1")],
      dfd,
    );

    const risk = result.riskData.risks.find((r) => r.threatId === "T-1")!;
    const rating = elRating(risk);
    expect(rating?.value).toBe(3); // EL2 → 1-based index 3
    expect(rating?.source).toBe("derived");
  });

  it("prefills exposure_level from the per-interaction anchor's crossing DataFlow EL", () => {
    const riskData = riskDataWithConfig(configWithELEnabled);
    const dfd = dfdWithConnectionEL("df-1", "EL4");

    const result = syncRisksFromThreats(
      riskData,
      [perInteractionThreat("T-2", "df-1")],
      dfd,
    );

    const risk = result.riskData.risks.find((r) => r.threatId === "T-2")!;
    expect(elRating(risk)?.value).toBe(5); // EL4 → index 5
  });

  it("is a no-op outside en-50742-a projects (exposure_level not enabled → no entry to fill)", () => {
    const riskData = riskDataWithConfig((c) => c); // DEFAULT_CONFIGURATION, EL disabled
    const dfd = dfdWithElementEL("if-1", "EL2");

    const result = syncRisksFromThreats(
      riskData,
      [perElementThreat("T-3", "if-1")],
      dfd,
    );

    const risk = result.riskData.risks.find((r) => r.threatId === "T-3")!;
    expect(elRating(risk)).toBeUndefined();
  });
});

describe("syncRisksFromThreats — EN 50742 EL prefill wiring (§11.2, existing risks)", () => {
  it("fills an existing unrated exposure_level entry on re-sync (e.g. after a later DFD save)", () => {
    const configuration = configWithELEnabled(createDefaultRiskData().configuration);
    const threat = perElementThreat("T-4", "if-1");
    const existingRisk = createEmptyRisk(threat, configuration);
    // Sanity: freshly created risk carries the factor, unrated.
    expect(elRating(existingRisk)?.value).toBe(0);

    const riskData: RiskData = {
      ...createDefaultRiskData(),
      configuration,
      risks: [existingRisk],
    };
    const dfd = dfdWithElementEL("if-1", "EL1");

    const result = syncRisksFromThreats(riskData, [threat], dfd);

    const risk = result.riskData.risks.find((r) => r.threatId === "T-4")!;
    expect(elRating(risk)?.value).toBe(2); // EL1 → index 2
    expect(elRating(risk)?.source).toBe("derived");
    expect(result.updated).toBeGreaterThan(0);
  });

  it("never overwrites a manually-set exposure_level on re-sync", () => {
    const configuration = configWithELEnabled(createDefaultRiskData().configuration);
    const threat = perElementThreat("T-5", "if-1");
    const existingRisk = createEmptyRisk(threat, configuration);
    const manualRisk = {
      ...existingRisk,
      factorRatings: existingRisk.factorRatings.map((r) =>
        r.factorId === "exposure_level"
          ? { ...r, value: 4, source: "manual" as const }
          : r,
      ),
    };

    const riskData: RiskData = {
      ...createDefaultRiskData(),
      configuration,
      risks: [manualRisk],
    };
    // DFD says EL1 (index 2) — must NOT override the analyst's manual EL4 (index 4).
    const dfd = dfdWithElementEL("if-1", "EL1");

    const result = syncRisksFromThreats(riskData, [threat], dfd);

    const risk = result.riskData.risks.find((r) => r.threatId === "T-5")!;
    expect(elRating(risk)?.value).toBe(4);
    expect(elRating(risk)?.source).toBe("manual");
  });
});
