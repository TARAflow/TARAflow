// src/tests/unit/features/risks/services/risk-sync-service.attack-tree.test.ts
//
// 5b-2 — syncRisksFromAttackTrees is the SOLE owner of the attack_tree_likelihood
// factor. It runs after syncRisksFromThreats, additively, and sets/clears the
// factor per risk. The threat sync never touches it; reconcileFactorRatings
// passes source==="attack-tree" ratings through, so the factor survives a threat
// re-sync and only the tree sync changes it.
//
// Pure logic, no rendering.

import { describe, it, expect } from "vitest";
import { syncRisksFromAttackTrees } from "features/risks/services/risk-sync-service";
import { createDefaultRiskData } from "features/risks/models/risk-assessment-types";
import { createEmptyRisk } from "features/risks/models/risk-assessment-types";
import { ATTACK_TREE_LIKELIHOOD_FACTOR_ID } from "features/risks/models/risk-factor-types";
import type { RiskData } from "features/risks/models/risk-assessment-types";
import type { ThreatReference, AttackTreeLikelihoodReference } from "shared";

function threat(id: string): ThreatReference {
  return {
    id,
    displayId: id,
    strideCategory: "T",
    threatDescription: id,
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

function treeLik(
  riskId: string,
  mappedValue = 3,
): AttackTreeLikelihoodReference {
  return {
    riskId,
    treeId: "at-1",
    pathKey: "ROOT>leaf",
    strideCategory: "T",
    likelihoodComponent: 0.6,
    mappedValue,
  };
}

/** A RiskData with one risk for threat T-1 (no tree factor yet). */
function riskDataWithRisk(threatId = "T-1"): RiskData {
  const data = createDefaultRiskData();
  const risk = createEmptyRisk(threat(threatId), data.configuration);
  return { ...data, risks: [risk] };
}

function treeFactor(risk: {
  factorRatings: { factorId: string; value?: number; source?: string }[];
}) {
  return risk.factorRatings.find(
    (r) => r.factorId === ATTACK_TREE_LIKELIHOOD_FACTOR_ID,
  );
}

describe("syncRisksFromAttackTrees", () => {
  it("sets the tree factor on the matching risk (factor mode)", () => {
    const result = syncRisksFromAttackTrees(
      riskDataWithRisk("T-1"),
      [treeLik("T-1", 4)],
      "factor",
    );
    const risk = result.risks.find((r) => r.threatId === "T-1")!;
    const f = treeFactor(risk);
    expect(f?.value).toBe(4);
    expect(f?.source).toBe("attack-tree");
  });

  it("advisory mode writes NO tree factor", () => {
    const result = syncRisksFromAttackTrees(
      riskDataWithRisk("T-1"),
      [treeLik("T-1")],
      "advisory",
    );
    expect(treeFactor(result.risks[0])).toBeUndefined();
  });

  it("a risk with no matching reference gets no tree factor", () => {
    const result = syncRisksFromAttackTrees(
      riskDataWithRisk("T-1"),
      [treeLik("T-OTHER")],
      "factor",
    );
    expect(treeFactor(result.risks[0])).toBeUndefined();
  });

  it("recomputes before-mitigation likelihood from the tree factor", () => {
    const result = syncRisksFromAttackTrees(
      riskDataWithRisk("T-1"),
      [treeLik("T-1", 4)],
      "factor",
    );
    // With no other likelihood factors rated, the tree factor alone drives it.
    expect(result.risks[0].calculatedLikelihood).toBe(4);
  });

  it("removing the reference clears the tree factor on the next run", () => {
    const withFactor = syncRisksFromAttackTrees(
      riskDataWithRisk("T-1"),
      [treeLik("T-1")],
      "factor",
    );
    expect(treeFactor(withFactor.risks[0])).toBeDefined();

    const cleared = syncRisksFromAttackTrees(
      withFactor,
      [], // ref gone
      "factor",
    );
    expect(treeFactor(cleared.risks[0])).toBeUndefined();
  });

  it("leaves RiskData untouched when nothing changes (stable identity)", () => {
    const data = riskDataWithRisk("T-1");
    const result = syncRisksFromAttackTrees(data, [], "factor");
    // No refs, no existing tree factor → no change → same object.
    expect(result).toBe(data);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// attackTreeAssessment provenance (Punkt 4)
//
// syncRisksFromAttackTrees is the SOLE owner of BOTH the tree factor AND the
// attackTreeAssessment provenance field. Provenance is persisted in BOTH
// contribution modes — including "advisory", where the factor itself is
// never written. This is what makes advisory mode useful at all: without the
// provenance, "advisory" would show the analyst nothing.
// ──────────────────────────────────────────────────────────────────────────

describe("syncRisksFromAttackTrees — attackTreeAssessment provenance", () => {
  it("records attackTreeAssessment when a reference matches (factor mode)", () => {
    const result = syncRisksFromAttackTrees(
      riskDataWithRisk("T-1"),
      [treeLik("T-1", 4)],
      "factor",
    );
    const risk = result.risks.find((r) => r.threatId === "T-1")!;
    expect(risk.attackTreeAssessment).toEqual({
      treeId: "at-1",
      pathKey: "ROOT>leaf",
      likelihoodComponent: 0.6,
      strideCategory: "T",
    });
  });

  it("records attackTreeAssessment in advisory mode too, despite writing no factor", () => {
    const result = syncRisksFromAttackTrees(
      riskDataWithRisk("T-1"),
      [treeLik("T-1")],
      "advisory",
    );
    const risk = result.risks[0];
    expect(treeFactor(risk)).toBeUndefined();
    expect(risk.attackTreeAssessment).toEqual({
      treeId: "at-1",
      pathKey: "ROOT>leaf",
      likelihoodComponent: 0.6,
      strideCategory: "T",
    });
  });

  it("clears attackTreeAssessment when the reference no longer matches", () => {
    const withAssessment = syncRisksFromAttackTrees(
      riskDataWithRisk("T-1"),
      [treeLik("T-1")],
      "factor",
    );
    expect(withAssessment.risks[0].attackTreeAssessment).toBeDefined();

    const cleared = syncRisksFromAttackTrees(withAssessment, [], "factor");
    expect(cleared.risks[0].attackTreeAssessment).toBeUndefined();
  });

  it("stable identity when re-run with the same matching reference (factor mode)", () => {
    const first = syncRisksFromAttackTrees(
      riskDataWithRisk("T-1"),
      [treeLik("T-1", 4)],
      "factor",
    );
    const second = syncRisksFromAttackTrees(
      first,
      [treeLik("T-1", 4)],
      "factor",
    );
    // Same ratings AND same assessment on the second pass → no change at all.
    expect(second).toBe(first);
    expect(second.risks[0]).toBe(first.risks[0]);
  });

  it("an assessment-only change (advisory, no rating change) still counts as changed", () => {
    const first = syncRisksFromAttackTrees(
      riskDataWithRisk("T-1"),
      [treeLik("T-1")],
      "advisory",
    );
    // A different tree now feeds the same risk; advisory never writes a
    // factor either time, so factorRatings is identical before and after —
    // only attackTreeAssessment differs. That alone must still trigger a
    // new risk object, or the provenance update would be silently lost.
    const second = syncRisksFromAttackTrees(
      first,
      [{ ...treeLik("T-1"), treeId: "at-2", pathKey: "ROOT>other" }],
      "advisory",
    );

    expect(treeFactor(second.risks[0])).toBeUndefined(); // ratings unaffected
    expect(second).not.toBe(first);
    expect(second.risks[0]).not.toBe(first.risks[0]);
    expect(second.risks[0].attackTreeAssessment).toEqual({
      treeId: "at-2",
      pathKey: "ROOT>other",
      likelihoodComponent: 0.6,
      strideCategory: "T",
    });
  });
});