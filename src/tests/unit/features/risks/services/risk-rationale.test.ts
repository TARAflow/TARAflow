// tests/unit/features/risks/services/risk-rationale.test.ts
//
// First Risk-feature tests. Cover the two ways the new assessment-rationale
// fields can break SILENTLY:
//   (1) migration: old projects predate the fields → must backfill to "" not undefined
//   (2) sync: syncRisksFromThreats must preserve analyst-owned rationale across a
//       threat change (the kept-risk merge only overwrites threat-derived fields).
//
// Inline fixtures on purpose — no risk-factory yet; introduce one when a third
// Risk test shows real repetition.
//
// ⚠ WIRING: deep import specifiers; adjust to your vitest/tsconfig aliases.

import { describe, it, expect } from "vitest";
import {
  createEmptyRisk,
  createDefaultRiskData,
  migrateRiskData,
  type Risk,
  type RiskData,
} from "features/risks/models/risk-assessment-types";
import type { ThreatReference } from "shared";
import { syncRisksFromThreats } from "features/risks/services/risk-sync-service";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

function makeThreatRef(overrides: Partial<ThreatReference> = {}): ThreatReference {
  return {
    id: "P1-S-1",
    strideCategory: "S",
    threatDescription: "Spoofing of P-1",
    attackDescription: "Attacker impersonates P-1",
    sourceStrideMethod: "per-element",
    relevance: "relevant", // MUST be relevant/uncertain → eligible → reaches kept-risk merge
    proposedMitigations: [],
    proposedVerifications: [],
    trustBoundaryId: null,
    trustBoundaryName: null,
    ...overrides,
  };
}

/** A RiskData containing one rated risk with both rationales filled. */
function makeRiskDataWithRationale(threat: ThreatReference): RiskData {
  const data = createDefaultRiskData();
  const risk: Risk = {
    ...createEmptyRisk(threat, data.configuration),
    riskBeforeRationale: "Physical access to the ECU is required.",
    riskAfterRationale: "Mutual auth removes remote paths; physical access remains.",
  };
  return { ...data, risks: [risk] };
}

// ──────────────────────────────────────────────────────────────────────────
// (1) Migration backfill
// ──────────────────────────────────────────────────────────────────────────

describe("migrateRiskData — assessment rationale backfill", () => {
  it("backfills both rationale fields to \"\" for a legacy risk missing them (no-config branch)", () => {
    // Legacy project: no configuration, risk lacks the new fields entirely.
    const legacy = {
      risks: [{ id: "R-P1-S-1", threatId: "P1-S-1" } as unknown as Risk],
      lastModified: new Date().toISOString(),
    } as unknown as RiskData;

    const migrated = migrateRiskData(legacy)!;
    expect(migrated.risks[0].riskBeforeRationale).toBe("");
    expect(migrated.risks[0].riskAfterRationale).toBe("");
  });

  it("backfills both rationale fields for a legacy risk (normal/config branch)", () => {
    const data = createDefaultRiskData();
    const legacyRisk = { id: "R-P1-S-1", threatId: "P1-S-1" } as unknown as Risk;
    const legacy: RiskData = { ...data, risks: [legacyRisk] };

    const migrated = migrateRiskData(legacy)!;
    expect(migrated.risks[0].riskBeforeRationale).toBe("");
    expect(migrated.risks[0].riskAfterRationale).toBe("");
  });

  it("preserves existing rationale text through migration", () => {
    const threat = makeThreatRef();
    const data = makeRiskDataWithRationale(threat);

    const migrated = migrateRiskData(data)!;
    expect(migrated.risks[0].riskBeforeRationale).toBe(
      "Physical access to the ECU is required.",
    );
    expect(migrated.risks[0].riskAfterRationale).toBe(
      "Mutual auth removes remote paths; physical access remains.",
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// (2) Sync survival
// ──────────────────────────────────────────────────────────────────────────

describe("syncRisksFromThreats — assessment rationale survives", () => {
  it("keeps both rationales when a kept risk is UPDATED by a changed threat", () => {
    const threat = makeThreatRef();
    const data = makeRiskDataWithRationale(threat);

    // Mutate a threat-derived field so the kept-risk merge actually runs
    // (otherwise it short-circuits with `return risk` and proves nothing).
    const changedThreat = makeThreatRef({
      threatDescription: "Spoofing of P-1 (revised wording)",
    });

    const result = syncRisksFromThreats(data, [changedThreat]);

    expect(result.updated).toBeGreaterThan(0); // merge branch was exercised
    const synced = result.riskData.risks.find((r) => r.threatId === threat.id)!;
    expect(synced.riskBeforeRationale).toBe(
      "Physical access to the ECU is required.",
    );
    expect(synced.riskAfterRationale).toBe(
      "Mutual auth removes remote paths; physical access remains.",
    );
    // sanity: the threat-derived field WAS updated
    expect(synced.threatDescription).toBe("Spoofing of P-1 (revised wording)");
  });

  it("new risks created during sync have empty (not undefined) rationales", () => {
    const data = createDefaultRiskData(); // no risks yet
    const threat = makeThreatRef();

    const result = syncRisksFromThreats(data, [threat]);

    expect(result.added).toBeGreaterThan(0);
    const created = result.riskData.risks.find((r) => r.threatId === threat.id)!;
    expect(created.riskBeforeRationale).toBe("");
    expect(created.riskAfterRationale).toBe("");
  });
});