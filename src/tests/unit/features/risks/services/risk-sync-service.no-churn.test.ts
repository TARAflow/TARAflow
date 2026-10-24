// src/tests/unit/features/risks/services/risk-sync-service.no-churn.test.ts
//
// ISO/SAE 21434 conformance plan F2: a sync without a change leaves the risk
// data untouched — no new lastModified on the risks or the container. The
// project file is written with sorted keys, so after a reload the stored
// ratings / provenance differ from freshly built objects only in key order;
// the comparison must not see that as a change.

import { describe, it, expect } from "vitest";
import {
  syncRisksFromAttackTrees,
  syncRisksFromThreats,
} from "features/risks/services/risk-sync-service";
import {
  createDefaultRiskData,
  createEmptyRisk,
  type RiskData,
} from "features/risks/models/risk-assessment-types";
import { canonicalStringify } from "shared/utils/tcs-canonical";
import type { AttackTreeLikelihoodReference, ThreatReference } from "shared";

function threat(id: string, description = id): ThreatReference {
  return {
    id,
    displayId: id,
    strideCategory: "T",
    threatDescription: description,
    attackDescription: "",
    sourceStrideMethod: "attack-path",
    relevance: "relevant",
    proposedMitigations: [],
    proposedVerifications: [],
    trustBoundaryId: null,
    trustBoundaryName: null,
    linkedAssetIds: [],
  };
}

function treeLik(riskId: string, mappedValue = 3): AttackTreeLikelihoodReference {
  return {
    riskId,
    treeId: "at-1",
    pathKey: "ROOT>leaf",
    strideCategory: "T",
    likelihoodComponent: 0.6,
    mappedValue,
    levelToRiskScale: { "very-low": 1, low: 2, medium: 3, high: 4 },
  };
}

/** Save and open again: sorted keys, as the project file stores them. */
const reload = <T>(value: T): T => JSON.parse(canonicalStringify(value));

const THREATS = [threat("T-1"), threat("T-2")];

/** Two risks with the tree factor and provenance, as stored on disk. */
function storedRiskData(): RiskData {
  const data = createDefaultRiskData();
  const synced = syncRisksFromThreats(
    { ...data, risks: [] },
    THREATS,
  ).riskData;
  const withTree = syncRisksFromAttackTrees(
    synced,
    [treeLik("T-1"), treeLik("T-2")],
    "factor",
  );
  return reload({
    ...withTree,
    lastModified: "t0",
    risks: withTree.risks.map((r) => ({ ...r, lastModified: "t0" })),
  });
}

describe("risk sync without a change (F2)", () => {
  it("tree sync on reloaded data returns the same object", () => {
    const stored = storedRiskData();
    const out = syncRisksFromAttackTrees(
      stored,
      [treeLik("T-1"), treeLik("T-2")],
      "factor",
    );
    expect(out).toBe(stored);
  });

  it("threat sync on reloaded data returns the same object", () => {
    const stored = storedRiskData();
    const result = syncRisksFromThreats(stored, THREATS);
    expect(result.updated).toBe(0);
    expect(result.riskData).toBe(stored);
  });

  it("a real tree change dates only the changed risk", () => {
    const stored = storedRiskData();
    const out = syncRisksFromAttackTrees(
      stored,
      [treeLik("T-1", 4), treeLik("T-2")],
      "factor",
    );
    const [r1, r2] = out.risks;
    expect(r1.lastModified).not.toBe("t0");
    expect(r2).toBe(stored.risks[1]);
    expect(out.lastModified).not.toBe("t0");
  });

  it("a real threat change dates only the changed risk", () => {
    const stored = storedRiskData();
    const result = syncRisksFromThreats(stored, [threat("T-1", "changed"), threat("T-2")]);
    expect(result.updated).toBe(1);
    expect(result.riskData.risks[0].lastModified).not.toBe("t0");
    expect(result.riskData.risks[1]).toBe(stored.risks[1]);
    expect(result.riskData.lastModified).not.toBe("t0");
  });
});
