// src/tests/unit/features/risks/services/risk-sync-service.en50742-gate-wiring.test.ts
//
// §11.2 (part E) wiring: syncRisksFromThreats must route calculatedImpact/
// Likelihood/RiskBeforeMitigation through calculateGatedRiskValues (not the
// plain generic calculateRiskValues) on BOTH paths — new risks and updated
// risks — and persist calculatedSrsl/calculatedApScore/calculatedApBand on
// the resulting Risk. calculatedRiskAfterMitigation must stay ungated (§3.8).
//
// This is deliberately an end-to-end test of the sync pipeline (EL prefill →
// gate → persisted Risk fields), not a unit test of calculateGatedRiskValues
// itself (that's en50742-gate.test.ts) or of the EL adapter (that's
// en50742-exposure-level-adapter.test.ts / risk-sync-service.en50742-el-prefill.test.ts).
//
// Pure logic, no rendering.

import { describe, it, expect } from "vitest";
import { checkRiskSyncStatus, syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import {
  createDefaultRiskData,
  createEmptyRisk,
} from "features/risks/models/risk-assessment-types";
import type { RiskData } from "features/risks/models/risk-assessment-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";
import type { ThreatReference, DFDReference, AssetReference, AssetDataReference } from "shared";

// ── Fixtures (mirrors risk-sync-service.en50742-el-prefill.test.ts) ───────

function baseThreat(id: string): ThreatReference {
  return {
    id,
    displayId: id,
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

function perElementThreat(
  id: string,
  elementId: string,
  linkedAssetIds: string[] = [],
): ThreatReference {
  return {
    ...baseThreat(id),
    linkedAssetIds,
    linkedElement: {
      elementId,
      elementName: "Auth Interface",
      elementType: "Interface",
      displayId: "IF-1",
    },
  };
}

function dfdWithElementEL(elementId: string, exposureLevel: string): DFDReference {
  return {
    elements: [{ id: elementId, properties: { exposureLevel } }],
    connections: [],
  };
}

function asset(
  id: string,
  physicalImpact?: "reversible_major" | "irreversible_major" | "fatal",
): AssetReference {
  return {
    id,
    name: id,
    assetGroup: "process",
    overallImpact: 0,
    ...(physicalImpact ? { physicalImpact } : {}),
  } as AssetReference;
}

function assetDataRef(assets: AssetReference[]): AssetDataReference {
  return { assets } as AssetDataReference;
}

function configWithEN50742Enabled(base: RiskConfiguration): RiskConfiguration {
  return {
    ...base,
    likelihoodMethod: "en-50742-a",
    windowOfOpportunity: "moderately_restricted",
    activeFactors: base.activeFactors.map((f) =>
      f.factorId === "exposure_level" || f.factorId === "attacker_capability"
        ? { ...f, enabled: true }
        : f,
    ),
  };
}

function riskDataWithConfig(configure: (c: RiskConfiguration) => RiskConfiguration): RiskData {
  const data = createDefaultRiskData();
  return { ...data, configuration: configure(data.configuration) };
}

function riskById(result: ReturnType<typeof syncRisksFromThreats>, threatId: string) {
  return result.riskData.risks.find((r) => r.threatId === threatId)!;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("syncRisksFromThreats — §11.2 gate wiring, new risks", () => {
  it("captures EL via the prefill even though a brand-new risk can't have SRSL yet (AC is never auto-rated)", () => {
    // attacker_capability is the ONE truly manually-rated EN 50742 factor
    // (§2.3) — there is no adapter for it, so a freshly-created risk always
    // has AC unrated (value 0), regardless of whether EL was derivable. The
    // gate is EL-based (§11.2), so the EN 50742 path IS entered here — but
    // en50742RiskFromResolved's `!el || !ac` guard correctly keeps srsl null
    // until the analyst rates AC. This pins that EL prefill still ran (proof
    // the gate was engaged), distinct from the "no EL anchor at all" case
    // below, which is indistinguishable in calculatedSrsl alone.
    const riskData = riskDataWithConfig(configWithEN50742Enabled);
    const dfd = dfdWithElementEL("if-1", "EL2");
    const threat = perElementThreat("T-1", "if-1", ["A-1"]);
    const assets = assetDataRef([asset("A-1", "irreversible_major")]);

    const result = syncRisksFromThreats(riskData, [threat], dfd, assets);
    const risk = riskById(result, "T-1");

    const elRating = risk.factorRatings.find((r) => r.factorId === "exposure_level");
    expect(elRating?.value).toBeGreaterThan(0); // EL WAS derived
    expect(elRating?.source).toBe("derived");
    expect(risk.calculatedSrsl).toBeNull(); // but AC still unrated → no SRSL yet
    expect(risk.calculatedApBand).toBeNull();
  });

  it("sets calculatedSrsl/apScore/apBand explicitly null when EL cannot be derived (gate inactive)", () => {
    const riskData = riskDataWithConfig(configWithEN50742Enabled);
    const dfd: DFDReference = { elements: [], connections: [] }; // no EL anywhere
    const threat = perElementThreat("T-2", "if-1", ["A-1"]);
    const assets = assetDataRef([asset("A-1", "fatal")]);

    const result = syncRisksFromThreats(riskData, [threat], dfd, assets);
    const risk = riskById(result, "T-2");

    expect(risk.calculatedSrsl).toBeNull();
    expect(risk.calculatedApScore).toBeNull();
    expect(risk.calculatedApBand).toBeNull();
  });

  it("leaves calculatedSrsl/apScore/apBand undefined for non-en-50742-a projects", () => {
    const riskData = createDefaultRiskData(); // likelihoodMethod undefined → "weighted-mean"
    const dfd = dfdWithElementEL("if-1", "EL2");
    const threat = perElementThreat("T-3", "if-1", ["A-1"]);
    const assets = assetDataRef([asset("A-1", "fatal")]);

    const result = syncRisksFromThreats(riskData, [threat], dfd, assets);
    const risk = riskById(result, "T-3");

    expect(risk.calculatedSrsl).toBeUndefined();
    expect(risk.calculatedApScore).toBeUndefined();
    expect(risk.calculatedApBand).toBeUndefined();
  });
});

describe("syncRisksFromThreats — §11.2 gate wiring, existing risks (re-sync)", () => {
  it("gates calculatedImpact/Likelihood/RiskBeforeMitigation on re-sync once EL becomes derivable (AC already rated by the analyst)", () => {
    const configuration = configWithEN50742Enabled(createDefaultRiskData().configuration);
    const threat = perElementThreat("T-4", "if-1", ["A-1"]);
    const emptyRisk = createEmptyRisk(threat, configuration);
    const existingRisk = {
      ...emptyRisk,
      linkedAssetIds: ["A-1"],
      // Simulates the analyst having already rated AC in an earlier session —
      // attacker_capability is never auto-derived (§2.3), so this is the only
      // way it's ever non-zero. EL, by contrast, arrives fresh via this sync
      // (the DFD wasn't saved with an EL yet when the risk was first created).
      factorRatings: emptyRisk.factorRatings.map((r) =>
        r.factorId === "attacker_capability" ? { ...r, value: 4 } : r,
      ),
    };
    const riskData: RiskData = {
      ...createDefaultRiskData(),
      configuration,
      risks: [existingRisk],
    };
    const dfd = dfdWithElementEL("if-1", "EL3");
    const assets = assetDataRef([asset("A-1", "fatal")]);

    const result = syncRisksFromThreats(riskData, [threat], dfd, assets);
    const risk = riskById(result, "T-4");

    expect(risk.calculatedSrsl).not.toBeNull();
    expect(risk.calculatedApBand).not.toBeNull();
    expect(result.updated).toBeGreaterThan(0);
  });

  it("calculatedRiskAfterMitigation stays the plain generic value, never gated (§3.8)", () => {
    // Even with SRSL active on the Before side, mitigatedFactorRatings has no
    // exposure_level entry at all in this fixture (createEmptyRisk gives it
    // an empty mitigatedFactorRatings-equivalent set) — so the After value
    // must come out identical to whatever the plain generic calc produces,
    // never influenced by SRSL/AP.
    const configuration = configWithEN50742Enabled(createDefaultRiskData().configuration);
    const threat = perElementThreat("T-5", "if-1", ["A-1"]);
    const existingRisk = {
      ...createEmptyRisk(threat, configuration),
      linkedAssetIds: ["A-1"],
    };
    const riskData: RiskData = {
      ...createDefaultRiskData(),
      configuration,
      risks: [existingRisk],
    };
    const dfd = dfdWithElementEL("if-1", "EL4");
    const assets = assetDataRef([asset("A-1", "fatal")]);

    const result = syncRisksFromThreats(riskData, [threat], dfd, assets);
    const risk = riskById(result, "T-5");

    // No "calculatedSrslAfter" field exists on Risk at all — the type itself
    // enforces that SRSL has no mitigated counterpart. This just pins that
    // the After number is unaffected by the Before-side gate being active.
    expect(risk.calculatedRiskAfterMitigation).toBe(0); // unrated mitigatedFactorRatings
  });
});
// ── O18 (user 2026-11-20): only EN 50742 relevant anchors get EL / SRSL ──

describe("syncRisksFromThreats — O18 relevance gate", () => {
  const configuration = configWithEN50742Enabled(createDefaultRiskData().configuration);
  const dfd = dfdWithElementEL("if-1", "EL3");
  const assets = assetDataRef([asset("A-1", "fatal")]);
  const rated = (threat: ThreatReference) => {
    const empty = createEmptyRisk(threat, configuration);
    return {
      ...empty,
      linkedAssetIds: ["A-1"],
      factorRatings: empty.factorRatings.map((r) => (r.factorId === "attacker_capability" ? { ...r, value: 4 } : r)),
    };
  };

  it("a relevant anchor: EL derived, SRSL computed (as before)", () => {
    const threat = { ...perElementThreat("T-R", "if-1", ["A-1"]), en50742: { relevant: true } };
    const result = syncRisksFromThreats({ ...createDefaultRiskData(), configuration, risks: [rated(threat)] }, [threat], dfd, assets);
    const risk = riskById(result, "T-R");
    expect(risk.factorRatings.find((r) => r.factorId === "exposure_level")?.source).toBe("derived");
    expect(risk.calculatedSrsl).not.toBeNull();
  });

  it("a new risk on a not relevant anchor: no EL derived, no SRSL", () => {
    const threat = { ...perElementThreat("T-N", "if-1", ["A-1"]), en50742: { relevant: false } };
    const result = syncRisksFromThreats({ ...createDefaultRiskData(), configuration }, [threat], dfd, assets);
    const risk = riskById(result, "T-N");
    expect(risk.factorRatings.find((r) => r.factorId === "exposure_level")?.value ?? 0).toBe(0);
    expect(risk.calculatedSrsl).toBeNull();
  });

  it("an existing risk whose anchor is no longer relevant: derived EL reset, SRSL taken away, the sync status says so", () => {
    const relevant = { ...perElementThreat("T-X", "if-1", ["A-1"]), en50742: { relevant: true } };
    const before = syncRisksFromThreats({ ...createDefaultRiskData(), configuration, risks: [rated(relevant)] }, [relevant], dfd, assets);
    expect(riskById(before, "T-X").calculatedSrsl).not.toBeNull();

    const outside = { ...relevant, en50742: { relevant: false } };
    const status = checkRiskSyncStatus(before.riskData, [outside], dfd, assets);
    expect(status.changedExposureLevels).toBe(1);
    const after = syncRisksFromThreats(before.riskData, [outside], dfd, assets);
    const risk = riskById(after, "T-X");
    expect(risk.calculatedSrsl).toBeNull();
    expect(risk.factorRatings.find((r) => r.factorId === "exposure_level")?.value).toBe(0);
  });

  it("a manual EL stays in the ratings, but the risk gets no SRSL when not relevant", () => {
    const threat = { ...perElementThreat("T-M", "if-1", ["A-1"]), en50742: { relevant: false } };
    const risk0 = rated(threat);
    const manual = {
      ...risk0,
      factorRatings: risk0.factorRatings.map((r) => (r.factorId === "exposure_level" ? { ...r, value: 4, source: "manual" as const } : r)),
      calculatedSrsl: "SRSL2" as const,
    };
    const result = syncRisksFromThreats({ ...createDefaultRiskData(), configuration, risks: [manual] }, [threat], dfd, assets);
    const risk = riskById(result, "T-M");
    expect(risk.factorRatings.find((r) => r.factorId === "exposure_level")).toMatchObject({ value: 4, source: "manual" });
    expect(risk.calculatedSrsl).toBeNull();
  });

  it("no decision (absent en50742, e.g. other projects): unchanged behaviour", () => {
    const threat = perElementThreat("T-U", "if-1", ["A-1"]);
    const result = syncRisksFromThreats({ ...createDefaultRiskData(), configuration, risks: [rated(threat)] }, [threat], dfd, assets);
    expect(riskById(result, "T-U").calculatedSrsl).not.toBeNull();
  });
});

describe("syncRisksFromThreats — the overlay of EN 50742 A on ETSI TVRA (0.20)", () => {
  const tvraWithA = (base: RiskConfiguration): RiskConfiguration => ({
    ...configWithEN50742Enabled(base),
    likelihoodMethod: "etsi-tvra",
    en50742Overlay: true,
  });

  it("TVRA + A: the SRSL is computed as with the standard method", () => {
    const configuration = tvraWithA(createDefaultRiskData().configuration);
    const threat = perElementThreat("T-10", "if-1", ["A-1"]);
    const empty = createEmptyRisk(threat, configuration);
    const existing = {
      ...empty,
      linkedAssetIds: ["A-1"],
      factorRatings: empty.factorRatings.map((r) => (r.factorId === "attacker_capability" ? { ...r, value: 4 } : r)),
    };
    const result = syncRisksFromThreats(
      { ...createDefaultRiskData(), configuration, risks: [existing] },
      [threat],
      dfdWithElementEL("if-1", "EL3"),
      assetDataRef([asset("A-1", "fatal")]),
    );
    expect(riskById(result, "T-10").calculatedSrsl).not.toBeNull();
  });

  it("the A tag removed: a stored SRSL goes on the next sync, also without a rating change", () => {
    const configuration = createDefaultRiskData().configuration; // no overlay
    const threat = perElementThreat("T-11", "if-1", ["A-1"]);
    const stored = { ...createEmptyRisk(threat, configuration), linkedAssetIds: ["A-1"], calculatedSrsl: "SRSL2" as const, calculatedApScore: 7, calculatedApBand: null };
    const riskData: RiskData = { ...createDefaultRiskData(), configuration, risks: [stored] };
    const dfd: DFDReference = { elements: [], connections: [] };
    const assets = assetDataRef([asset("A-1", "fatal")]);
    expect(checkRiskSyncStatus(riskData, [threat], dfd).changedExposureLevels).toBe(1);
    const risk = riskById(syncRisksFromThreats(riskData, [threat], dfd, assets), "T-11");
    expect(risk.calculatedSrsl).toBeUndefined();
    expect(risk.calculatedApScore).toBeUndefined();
  });
});
