// src/tests/unit/features/risks/services/risk-sync-service.display-id-drift.test.ts
//
// A DFD renumber relabels threats (displayId) while their identity (the UUID
// in threat.id / risk.threatId) stays stable. checkRiskSyncStatus must report
// that label drift so the sync affordance lights up, and syncRisksFromThreats
// must refresh risk.threatDisplayId from the threat it points at.
//
// Pure logic, no rendering.

import { describe, it, expect } from "vitest";
import {
  checkRiskSyncStatus,
  syncRisksFromThreats,
} from "features/risks/services/risk-sync-service";
import {
  createDefaultRiskData,
  createEmptyRisk,
} from "features/risks/models/risk-assessment-types";
import type { RiskData } from "features/risks/models/risk-assessment-types";
import type { ThreatReference } from "shared";

const THREAT_UUID = "5b0c8a3e-1111-4c2a-9f00-000000000001";

function threat(displayId: string): ThreatReference {
  return {
    id: THREAT_UUID,
    displayId,
    strideCategory: "I",
    threatDescription: "Information disclosure on the data flow",
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

function riskDataFor(t: ThreatReference): RiskData {
  const data = createDefaultRiskData();
  return { ...data, risks: [createEmptyRisk(t, data.configuration)] };
}

describe("checkRiskSyncStatus — threat display-id drift", () => {
  it("is clean when the risk label matches the threat label", () => {
    const t = threat("DF31-I-1");
    const status = checkRiskSyncStatus(riskDataFor(t), [t]);

    expect(status.changedDisplayIds).toBe(0);
  });

  it("flags a renumbered threat (same UUID, new label) and requests a sync", () => {
    const before = threat("DF31-I-1");
    const riskData = riskDataFor(before);
    const after = threat("DF32-I-1"); // DFD renumber: DF-31 → DF-32

    const status = checkRiskSyncStatus(riskData, [after]);

    expect(status.changedDisplayIds).toBe(1);
    expect(status.needsSync).toBe(true);
    // Identity is intact — this is neither a new threat nor an orphan.
    expect(status.newThreats).toBe(0);
    expect(status.orphanedRisks).toBe(0);
  });

  it("clears once syncRisksFromThreats has refreshed the label", () => {
    const riskData = riskDataFor(threat("DF31-I-1"));
    const after = threat("DF32-I-1");

    const synced = syncRisksFromThreats(riskData, [after]);
    const risk = synced.riskData.risks[0];

    expect(risk.threatId).toBe(THREAT_UUID);
    expect(risk.threatDisplayId).toBe("DF32-I-1");
    expect(checkRiskSyncStatus(synced.riskData, [after]).changedDisplayIds).toBe(0);
  });
});
