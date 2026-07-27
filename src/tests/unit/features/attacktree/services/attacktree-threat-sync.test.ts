// src/tests/unit/features/attacktree/services/attacktree-threat-sync.test.ts
//
// PHASE 5a — asset-anchored attack-path threat sync.
//
// These tests fix the SEMANTICS and INVARIANTS the doc mandates, not the
// arithmetic of feasibility:
//
//   1. new path            → silent "unrated" (Class A)
//   2. assessed path gone  → banner, the decision is retained (Class B)
//   3. relevance survives an unrelated DSL edit (pathKey stability, Phase 1)
//   4. standalone / threat-anchored trees emit no new threats here
//
// plus the write-path edges (setPathAssessment) and the destruction→T+D split.

import { describe, it, expect } from "vitest";
import {
  createEmptyAttackTree,
  type AttackPath,
  type AttackTree,
  type AttackTreeAnchor,
  type PathAnalysis,
  type AttackPathAssessment,
} from "features/attacktree/models/attacktree-types";
import {
  computePathKey,
  buildAttackPathThreatId,
} from "features/attacktree/services/attacktree-path-identity";
import { buildThreatId } from "features/attacktree/services/attacktree-threat-generator";
import {
  reconcileAttackPathThreats,
  applyAssessmentsToThreats,
  deriveAssessedKeys,
  setPathAssessment,
  tupleForThreatId,
  applyRelevanceDecision,
  isPathAssessmentComplete,
  isReadyForRisk,
} from "features/attacktree/services/attacktree-threat-sync";

import { ThreatRelevanceRef } from "shared";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures — file-driven, minimal. Only the fields the sync touches are set.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Build an AttackPath from its ROOT→leaf name chain. pathKey is computed the
 * real way (Phase 1), so the tests exercise genuine identity, not a stub.
 */
function makePath(
  chain: string[],
  attackGoals: AttackPath["attackGoals"],
  overrides: Partial<AttackPath> = {},
): AttackPath {
  return {
    id: "path-display-only",
    pathKey: computePathKey(chain),
    path: chain,
    nodeIds: chain.map((_, i) => `n${i}`),
    // "medium" is a valid FeasibilityLevel (feasibility-types). A set level is
    // all the generator needs to consider the path emittable.
    feasibilityLevel: "medium",
    riskScore: 1,
    attackGoals,
    mitigations: [],
    isCritical: false,
    isFullyMitigated: false,
    ...overrides,
  };
}

function makeAnalysis(paths: AttackPath[]): PathAnalysis {
  return {
    paths,
    criticalPaths: [],
    maxRiskScore: 1,
    averageRiskScore: 1,
    totalPaths: paths.length,
    aggregatedLikelihood: 1,
    likelihoodMethod: "max",
    goalSummary: {
      disclosure: 0,
      manipulation: 0,
      "service-disruption": 0,
      "privilege-abuse": 0,
      "identity-misuse": 0,
      "accountability-evasion": 0,
      destruction: 0,
    },
    analysisDate: new Date().toISOString(),
  };
}

const ASSET_ANCHOR: AttackTreeAnchor = {
  type: "asset",
  assetId: "A-1",
  assetName: "Brake ECU",
};

function makeAssetTree(
  paths: AttackPath[],
  assessments?: AttackPathAssessment[],
): AttackTree {
  const tree = createEmptyAttackTree(ASSET_ANCHOR);
  tree.pathAnalysis = makeAnalysis(paths);
  if (assessments) tree.pathAssessments = assessments;
  // The tree's ast?.name feeds threatDescription; give it a stable name so the
  // generator doesn't fall back to the (timestamped) default tree name.
  tree.name = "Brake ECU compromise";
  return tree;
}

// A single manipulation path → exactly one threat, STRIDE "T".
const MANIP_CHAIN = ["ROOT", "open enclosure", "flash firmware"];
const MANIP_KEY = computePathKey(MANIP_CHAIN);

// ──────────────────────────────────────────────────────────────────────────
// 1. New path → silent "unrated" (Class A)
// ──────────────────────────────────────────────────────────────────────────

describe("Class A — a new path appears silently as unrated", () => {
  it("emits the threat as unrated and raises no banner", () => {
    const tree = makeAssetTree([makePath(MANIP_CHAIN, ["manipulation"])]);

    // previous = undefined → first analysis, the path is an addition.
    const { threats, diff } = reconcileAttackPathThreats(tree, undefined);

    expect(threats).toHaveLength(1);
    expect(threats[0].relevance).toBe("unrated");
    expect(threats[0].id).toBe(buildThreatId(tree.id, MANIP_KEY, "T"));

    // Addition is Class A — no interruption.
    expect(diff.requiresBanner).toBe(false);
    expect(diff.changes).toHaveLength(1);
    expect(diff.changes[0]).toMatchObject({ changeClass: "A", kind: "added" });
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 2. Assessed path vanishes → banner, decision retained (Class B)
// ──────────────────────────────────────────────────────────────────────────

describe("Class B — an assessed path that vanishes raises a banner", () => {
  it("flags requiresBanner and keeps the assessment", () => {
    // Analyst confirmed the manipulation path.
    const assessment: AttackPathAssessment = {
      pathKey: MANIP_KEY,
      strideCategory: "T",
      relevance: "relevant",
      lastModified: new Date().toISOString(),
    };

    // previous had the path; next (the tree) no longer does.
    const previous = makeAnalysis([makePath(MANIP_CHAIN, ["manipulation"])]);
    const treeNow = makeAssetTree(
      [makePath(["ROOT", "different attack"], ["disclosure"])],
      [assessment],
    );

    const { diff, assessments } = reconcileAttackPathThreats(treeNow, previous);

    // The confirmed path is gone → Class B → banner.
    expect(diff.requiresBanner).toBe(true);
    const removed = diff.changes.find((c) => c.kind === "removed");
    expect(removed).toMatchObject({ changeClass: "B", pathKey: MANIP_KEY });

    // The decision is NOT silently discarded — it survives for the analyst to
    // act on from the banner.
    expect(assessments).toContainEqual(assessment);
  });

  it("a removed path nobody rated is Class A, not B", () => {
    const previous = makeAnalysis([makePath(MANIP_CHAIN, ["manipulation"])]);
    const treeNow = makeAssetTree(
      [makePath(["ROOT", "different attack"], ["disclosure"])],
      [], // no assessments at all
    );

    const { diff } = reconcileAttackPathThreats(treeNow, previous);

    expect(diff.requiresBanner).toBe(false);
    const removed = diff.changes.find((c) => c.kind === "removed");
    expect(removed?.changeClass).toBe("A");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 3. Relevance survives an unrelated DSL edit (pathKey stability)
// ──────────────────────────────────────────────────────────────────────────

describe("relevance survives an unrelated edit", () => {
  it("keeps the decision when a sibling path is added elsewhere", () => {
    const assessment: AttackPathAssessment = {
      pathKey: MANIP_KEY,
      strideCategory: "T",
      relevance: "relevant",
      lastModified: new Date().toISOString(),
    };

    // Before: just the manipulation path, confirmed.
    const previous = makeAnalysis([makePath(MANIP_CHAIN, ["manipulation"])]);

    // After: the SAME manipulation path plus a new sibling. The manipulation
    // path's chain is untouched, so its pathKey is unchanged.
    const treeNow = makeAssetTree(
      [
        makePath(MANIP_CHAIN, ["manipulation"]),
        makePath(["ROOT", "sniff CAN bus"], ["disclosure"]),
      ],
      [assessment],
    );

    const { threats, diff } = reconcileAttackPathThreats(treeNow, previous);

    // The confirmed threat is still confirmed after the overlay.
    const manipThreat = threats.find(
      (t) => t.id === buildThreatId(treeNow.id, MANIP_KEY, "T"),
    );
    expect(manipThreat?.relevance).toBe("relevant");

    // The new sibling is a silent addition; nothing was removed → no banner.
    expect(diff.requiresBanner).toBe(false);
    expect(diff.changes.every((c) => c.kind === "added")).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// 4. standalone / threat-anchored trees emit no new threats here
// ──────────────────────────────────────────────────────────────────────────

describe("only asset-anchored trees emit", () => {
  it("standalone tree emits nothing", () => {
    const tree = createEmptyAttackTree({ type: "standalone" });
    tree.pathAnalysis = makeAnalysis([makePath(MANIP_CHAIN, ["manipulation"])]);

    const { threats } = reconcileAttackPathThreats(tree, undefined);
    expect(threats).toHaveLength(0);
  });

  it("threat-anchored tree emits nothing (that is 5b, not here)", () => {
    const tree = createEmptyAttackTree({
      type: "threat",
      threatId: "T-42",
      threatTitle: "spoofed sensor",
      strideCategory: "S",
    });
    tree.pathAnalysis = makeAnalysis([makePath(MANIP_CHAIN, ["manipulation"])]);

    const { threats } = reconcileAttackPathThreats(tree, undefined);
    expect(threats).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// destruction → two separately-assessable threats (T and D)
// ──────────────────────────────────────────────────────────────────────────

describe("destruction path splits into two independently assessable threats", () => {
  it("confirming T leaves D unrated", () => {
    const chain = ["ROOT", "overload actuator"];
    const key = computePathKey(chain);

    const assessment: AttackPathAssessment = {
      pathKey: key,
      strideCategory: "T",
      relevance: "relevant",
      lastModified: new Date().toISOString(),
    };

    const tree = makeAssetTree(
      [makePath(chain, ["destruction"])],
      [assessment],
    );
    const { threats } = reconcileAttackPathThreats(tree, undefined);

    const t = threats.find((x) => x.id === buildThreatId(tree.id, key, "T"));
    const d = threats.find((x) => x.id === buildThreatId(tree.id, key, "D"));

    expect(threats).toHaveLength(2);
    expect(t?.relevance).toBe("relevant"); // confirmed
    expect(d?.relevance).toBe("unrated"); // independent, untouched
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Overlay + write-path units
// ──────────────────────────────────────────────────────────────────────────

describe("applyAssessmentsToThreats", () => {
  it("is a no-op when there are no assessments (returns fresh copies)", () => {
    const tree = makeAssetTree([makePath(MANIP_CHAIN, ["manipulation"])]);
    const { threats } = reconcileAttackPathThreats(tree, undefined);
    const overlaid = applyAssessmentsToThreats(tree, threats, []);
    expect(overlaid).toEqual(threats);
    expect(overlaid[0]).not.toBe(threats[0]); // new object, not the same ref
  });

  it("does not leak evalNote onto the threat (ThreatReference has no such field)", () => {
    const key = MANIP_KEY;
    const assessment: AttackPathAssessment = {
      pathKey: key,
      strideCategory: "T",
      relevance: "not_relevant",
      evalNote: "mitigated by tamper-evident seal",
      lastModified: new Date().toISOString(),
    };
    const tree = makeAssetTree(
      [makePath(MANIP_CHAIN, ["manipulation"])],
      [assessment],
    );
    const { threats } = reconcileAttackPathThreats(tree, undefined);
    expect(threats[0].relevance).toBe("not_relevant");
    expect("evalNote" in threats[0]).toBe(false);
  });
});

describe("deriveAssessedKeys", () => {
  it("includes only keys with a decision other than unrated", () => {
    const keys = deriveAssessedKeys([
      {
        pathKey: "k1",
        strideCategory: "T",
        relevance: "relevant",
        lastModified: "",
      },
      {
        pathKey: "k2",
        strideCategory: "D",
        relevance: "unrated",
        lastModified: "",
      },
      {
        pathKey: "k3",
        strideCategory: "S",
        relevance: "uncertain",
        lastModified: "",
      },
    ]);
    expect(keys).toEqual(new Set(["k1", "k3"]));
  });
});

describe("setPathAssessment", () => {
  it("adds a decision", () => {
    const next = setPathAssessment([], "k1", "T", "relevant", "note");
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({
      pathKey: "k1",
      strideCategory: "T",
      relevance: "relevant",
      evalNote: "note",
    });
  });

  it("replaces the decision for the same (pathKey, stride)", () => {
    const first = setPathAssessment([], "k1", "T", "relevant");
    const second = setPathAssessment(first, "k1", "T", "not_relevant");
    expect(second).toHaveLength(1);
    expect(second[0].relevance).toBe("not_relevant");
  });

  it("keeps decisions on the same path but a different stride separate", () => {
    const first = setPathAssessment([], "k1", "T", "relevant");
    const second = setPathAssessment(first, "k1", "D", "uncertain");
    expect(second).toHaveLength(2);
  });

  it("setting unrated clears the entry rather than storing inert noise", () => {
    const first = setPathAssessment([], "k1", "T", "relevant");
    const cleared = setPathAssessment(first, "k1", "T", "unrated");
    expect(cleared).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// tupleForThreatId — the inverse of buildThreatId (one shared id↔tuple mapping)
// ──────────────────────────────────────────────────────────────────────────

describe("tupleForThreatId", () => {
  it("round-trips with buildThreatId", () => {
    const treeId = "tree-1";
    const pathKey = computePathKey(["ROOT", "leaf"]);
    const id = buildThreatId(treeId, pathKey, "T");

    expect(tupleForThreatId(treeId, id, "T")).toEqual({
      pathKey,
      strideCategory: "T",
    });
  });

  it("recovers pathKeys that themselves contain hyphens", () => {
    // pathKeys are hex, but treeIds are not — a hyphenated treeId must not
    // confuse the prefix strip. This is the case string-parsing gets wrong.
    const treeId = "AT-project-42-tree-7";
    const pathKey = "abc123def456";
    const id = buildThreatId(treeId, pathKey, "D");

    expect(tupleForThreatId(treeId, id, "D")).toEqual({
      pathKey,
      strideCategory: "D",
    });
  });

  it("rejects an id whose stride does not match", () => {
    const treeId = "tree-1";
    const id = buildThreatId(treeId, "abc", "T");
    // Asking for stride "D" on a "T" id → no match.
    expect(tupleForThreatId(treeId, id, "D")).toBeNull();
  });

  it("rejects an id from a different tree", () => {
    const id = buildThreatId("tree-1", "abc", "T");
    expect(tupleForThreatId("tree-2", id, "T")).toBeNull();
  });

  it("rejects a foreign (non-attack-path) id", () => {
    // A per-element STRIDE id like "174-T-1" is not an AT- id.
    expect(tupleForThreatId("tree-1", "174-T-1", "T")).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// applyRelevanceDecision — the confirm/dismiss UI logic, tested WITHOUT
// rendering. The component is a thin shell over this; these tests pin the
// click→mutation behaviour (what the analyst's action actually produces).
// ──────────────────────────────────────────────────────────────────────────

describe("applyRelevanceDecision (confirm/dismiss table logic)", () => {
  const treeId = "tree-1";
  const chain = ["ROOT", "flash firmware"];
  const key = computePathKey(chain);
  const threatId = buildThreatId(treeId, key, "T");

  it("confirming a threat writes a 'relevant' assessment for its (pathKey, stride)", () => {
    const next = applyRelevanceDecision(treeId, [], threatId, "T", "relevant");
    expect(next).toEqual([
      expect.objectContaining({
        pathKey: key,
        strideCategory: "T",
        relevance: "relevant",
      }),
    ]);
  });

  it("dismissing then confirming replaces, not appends", () => {
    const dismissed = applyRelevanceDecision(
      treeId,
      [],
      threatId,
      "T",
      "not_relevant",
    );
    const confirmed = applyRelevanceDecision(
      treeId,
      dismissed,
      threatId,
      "T",
      "relevant",
    );
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0].relevance).toBe("relevant");
  });

  it("clearing to unrated removes the entry", () => {
    const confirmed = applyRelevanceDecision(
      treeId,
      [],
      threatId,
      "T",
      "relevant",
    );
    const cleared = applyRelevanceDecision(
      treeId,
      confirmed,
      threatId,
      "T",
      "unrated",
    );
    expect(cleared).toHaveLength(0);
  });

  it("a stray id from another tree leaves the array referentially unchanged", () => {
    const existing = setPathAssessment([], key, "T", "relevant");
    const foreignId = buildThreatId("other-tree", key, "T");
    const result = applyRelevanceDecision(
      treeId,
      existing,
      foreignId,
      "T",
      "not_relevant",
    );
    // Same reference — no silent mutation from a click that doesn't map here.
    expect(result).toBe(existing);
  });

  it("the two threats of a destruction path are decided independently", () => {
    const dChain = ["ROOT", "overload actuator"];
    const dKey = computePathKey(dChain);
    const tId = buildThreatId(treeId, dKey, "T");
    const dId = buildThreatId(treeId, dKey, "D");

    let assessments = applyRelevanceDecision(treeId, [], tId, "T", "relevant");
    assessments = applyRelevanceDecision(
      treeId,
      assessments,
      dId,
      "D",
      "not_relevant",
    );

    expect(assessments).toHaveLength(2);
    expect(assessments.find((a) => a.strideCategory === "T")?.relevance).toBe(
      "relevant",
    );
    expect(assessments.find((a) => a.strideCategory === "D")?.relevance).toBe(
      "not_relevant",
    );
  });
});

describe("setPathAssessment — mitigationIds", () => {
  it("persists an entry that is unrated but carries mitigations", () => {
    const out = setPathAssessment([], "pk-1", "T", "unrated", undefined, [
      "M-T-001",
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({
      pathKey: "pk-1",
      relevance: "unrated",
      mitigationIds: ["M-T-001"],
    });
  });

  it("does NOT wipe mitigations on a relevance-only rewrite (merge)", () => {
    const seed = setPathAssessment([], "pk-1", "T", "unrated", undefined, [
      "M-T-001",
    ]);
    const out = setPathAssessment(seed, "pk-1", "T", "relevant"); // mitigationIds undefined
    expect(out[0]).toMatchObject({
      relevance: "relevant",
      mitigationIds: ["M-T-001"],
    });
  });

  it("explicit [] clears mitigations and drops the entry when otherwise inert", () => {
    const seed = setPathAssessment([], "pk-1", "T", "unrated", undefined, [
      "M-T-001",
    ]);
    const out = setPathAssessment(seed, "pk-1", "T", "unrated", undefined, []);
    expect(out).toHaveLength(0);
  });

  it("still drops a truly inert unrated entry (legacy behaviour)", () => {
    const seed = setPathAssessment([], "pk-1", "T", "relevant", undefined, [
      "M-T-001",
    ]);
    const out = setPathAssessment(seed, "pk-1", "T", "unrated");
    // relevance cleared, mitigations preserved via merge → entry stays
    expect(out).toHaveLength(1);
    expect(out[0].mitigationIds).toEqual(["M-T-001"]);
  });
});

describe("applyRelevanceDecision — preserves mitigations", () => {
  it("confirming a path keeps its attached mitigations", () => {
    const treeId = "at-1";
    const pk = "pk-1";
    const threatId = buildThreatId(treeId, pk, "T");
    const seed = setPathAssessment([], pk, "T", "unrated", undefined, [
      "M-T-001",
    ]);
    const out = applyRelevanceDecision(treeId, seed, threatId, "T", "relevant");
    expect(out[0]).toMatchObject({
      relevance: "relevant",
      mitigationIds: ["M-T-001"],
    });
  });
});

describe("deriveAssessedKeys — mitigation-only", () => {
  it("counts an unrated path that carries mitigations", () => {
    const seed = setPathAssessment([], "pk-1", "T", "unrated", undefined, [
      "M-T-001",
    ]);
    expect(deriveAssessedKeys(seed).has("pk-1")).toBe(true);
  });
});

describe("isReadyForRisk", () => {
  const mk = (
    relevance: ThreatRelevanceRef,
    mitigationIds?: string[],
  ): AttackPathAssessment => ({
    pathKey: "pk",
    strideCategory: "T",
    relevance,
    mitigationIds,
    lastModified: "",
  });
  it("relevant + mitigation → ready", () =>
    expect(isReadyForRisk(mk("relevant", ["M-T-001"]))).toBe(true));
  it("relevant + no mitigation → not ready", () =>
    expect(isReadyForRisk(mk("relevant"))).toBe(false));
  it("not_relevant → ready", () =>
    expect(isReadyForRisk(mk("not_relevant"))).toBe(true));
  it("uncertain → not ready", () =>
    expect(isReadyForRisk(mk("uncertain"))).toBe(false));
  it("unrated → not ready", () =>
    expect(isReadyForRisk(mk("unrated"))).toBe(false));
});

describe("isPathAssessmentComplete", () => {
  const mk = (
    relevance: ThreatRelevanceRef,
    mitigationIds?: string[],
    verificationIds?: string[],
  ): AttackPathAssessment => ({
    pathKey: "pk",
    strideCategory: "T",
    relevance,
    mitigationIds,
    verificationIds,
    lastModified: "",
  });
  it("relevant + mitigation + verification → complete", () =>
    expect(
      isPathAssessmentComplete(mk("relevant", ["M-T-001"], ["V-T-001"])),
    ).toBe(true));
  it("relevant + mitigation, no verification → incomplete", () =>
    expect(isPathAssessmentComplete(mk("relevant", ["M-T-001"]))).toBe(false));
  it("relevant + verification, no mitigation → incomplete", () =>
    expect(
      isPathAssessmentComplete(mk("relevant", undefined, ["V-T-001"])),
    ).toBe(false));
  it("not_relevant → complete", () =>
    expect(isPathAssessmentComplete(mk("not_relevant"))).toBe(true));
  it("uncertain → incomplete", () =>
    expect(
      isPathAssessmentComplete(mk("uncertain", ["M-T-001"], ["V-T-001"])),
    ).toBe(false));
});