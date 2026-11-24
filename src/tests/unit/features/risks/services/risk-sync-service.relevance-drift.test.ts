// src/tests/unit/features/risks/services/risk-sync-service.relevance-drift.test.ts
//
// 0.20 manual test, 2026-11-24: two uncertain threats were confirmed in the
// Threats tab, but the Risks tab kept saying "4 risks are based on uncertain
// threats" — in the banner and in the findings. The risk keeps a copy of the
// threat relevance that only a risk sync updates, and a changed relevance did
// not count as a reason to sync.

import { describe, it, expect } from "vitest";
import { checkRiskSyncStatus, syncRisksFromThreats } from "features/risks/services/risk-sync-service";
import { riskFindings } from "features/risks/services/risk-findings";
import { createDefaultRiskData, createEmptyRisk } from "features/risks/models/risk-assessment-types";
import type { ThreatReference } from "shared";

const threat = (id: string, relevance: ThreatReference["relevance"]): ThreatReference => ({
  id,
  displayId: `P1-${id}`,
  strideCategory: "T",
  threatDescription: "Tampering",
  attackDescription: "",
  sourceStrideMethod: "per-element",
  relevance,
  proposedMitigations: [],
  proposedVerifications: [],
  trustBoundaryId: null,
  trustBoundaryName: null,
  linkedAssetIds: [],
});

function riskDataFor(threats: ThreatReference[]) {
  const data = createDefaultRiskData();
  return { ...data, risks: threats.map((t) => createEmptyRisk(t, data.configuration)) };
}

describe("a threat confirmed after the risk sync", () => {
  const before = [threat("T-1", "uncertain"), threat("T-2", "uncertain")];
  const after = [threat("T-1", "relevant"), threat("T-2", "uncertain")];
  const riskData = riskDataFor(before);

  it("is reported as a change and asks for a sync", () => {
    const status = checkRiskSyncStatus(riskData, after);
    expect(status.changedRelevance).toBe(1);
    expect(status.needsSync).toBe(true);
  });

  it("no longer counts as uncertain in the banner", () => {
    expect(checkRiskSyncStatus(riskData, after).uncertainRisks).toBe(1);
  });

  it("no longer counts as uncertain in the findings when the current relevance is passed", () => {
    const count = (opts: Parameters<typeof riskFindings>[1]) =>
      riskFindings(riskData, opts).find((f) => f.code === "uncertainThreats")?.count ?? 0;
    expect(count({})).toBe(2);
    expect(count({ currentRelevance: new Map(after.map((t) => [t.id, t.relevance])) })).toBe(1);
  });

  it("is in step again after the sync", () => {
    const data = syncRisksFromThreats(riskData, after).riskData;
    const status = checkRiskSyncStatus(data, after);
    expect(status.changedRelevance).toBe(0);
    expect(status.needsSync).toBe(false);
    expect(status.uncertainRisks).toBe(1);
  });
});
