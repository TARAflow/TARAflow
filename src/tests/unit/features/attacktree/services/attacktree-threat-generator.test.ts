// tests/unit/features/attacktree/services/attacktree-threat-generator.test.ts
//
// PHASE 4 — the attack tree emits THREATS, not Risks.
//
// That single choice is what keeps Risk.threatId, generateRiskId() and
// syncRisksFromThreats() untouched, and keeps the Risks tab a single register.
//
// The failures this guards against are all failures of SILENCE:
//
//   - an unrated path becoming a threat with no likelihood, sitting in the
//     register looking like the safest thing in the project
//   - a `destruction` path emitting one threat that claims to be both T and D,
//     which cannot be treated cleanly
//   - a standalone tree contributing an asset-less entry nobody can attribute
//   - the "cheapest path" wobbling between runs, so confirm decisions drift off
//     the paths they were made about

import { describe, it, expect } from "vitest";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import { attackTreeCalculator } from "features/attacktree/services/attacktree-calculator";
import {
  DEFAULT_EMISSION_OPTIONS,
  attackTreeThreatGenerator,
  type EmissionOptions,
} from "features/attacktree/services/attacktree-threat-generator";
import type {
  AttackTree,
  AttackTreeAnchor,
} from "features/attacktree/models/attacktree-types";

// ──────────────────────────────────────────────────────────────────────────
// Fixtures
// ──────────────────────────────────────────────────────────────────────────

const ASSET_ANCHOR: AttackTreeAnchor = {
  type: "asset",
  assetId: "A-001",
  assetName: "Config Database",
  securityGoal: "C",
};

/** Build a parsed, analysed tree straight from DSL. */
function makeTree(
  dsl: string,
  anchor: AttackTreeAnchor = ASSET_ANCHOR,
): AttackTree {
  const parsed = attackTreeParser.parse(dsl, "simple");
  if (!parsed.ast) {
    throw new Error(
      `fixture failed to parse: ${parsed.errors.map((e) => e.message).join("; ")}`,
    );
  }

  return {
    id: "at-1",
    name: "Steal Config",
    anchor,
    dsl,
    ast: parsed.ast,
    pathAnalysis: attackTreeCalculator.analyzeAttackPaths(parsed.ast, "simple"),
    configuration: { evaluationMethod: "simple" },
  } as unknown as AttackTree;
}

const SIMPLE_TREE = [
  "Steal Config [A-001];ROOT @disclosure",
  "\tRemote Path;OR",
  "\t\tExploit API;p=0.9,i=3 [M-001]",
  "\t\tSniff Traffic;p=0.2,i=2 [M-002]",
].join("\n");

function opts(overrides: Partial<EmissionOptions> = {}): EmissionOptions {
  return { ...DEFAULT_EMISSION_OPTIONS, ...overrides };
}

// ──────────────────────────────────────────────────────────────────────────
// What a threat looks like
// ──────────────────────────────────────────────────────────────────────────

describe("generateThreatsFromAttackTree — the emitted threat", () => {
  it("emits a threat reference, not a Risk — that is the whole design", () => {
    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(SIMPLE_TREE),
      opts({ policy: "all" }),
    );

    const threat = threats[0];
    expect(threat.relevance).toBe("unrated"); // the analyst still decides
    // Provenance rides on sourceStrideMethod — no separate `source` field, and
    // no workflowStatus: those belong to the full Threat the app layer builds
    // from this reference at sync time (Phase 5).
    expect(threat.sourceStrideMethod).toBe("attack-path");
  });

  it("maps the attack goal onto a STRIDE category", () => {
    // ATTACK_GOAL_TO_STRIDE: disclosure → I (information disclosure)
    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(SIMPLE_TREE),
      opts({ policy: "all" }),
    );

    expect(threats.every((t) => t.strideCategory === "I")).toBe(true);
  });

  it("the attack chain becomes the attackDescription", () => {
    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(SIMPLE_TREE),
      opts({ policy: "all" }),
    );

    const exploit = threats.find((t) => t.attackDescription.includes("Exploit API"))!;
    expect(exploit.attackDescription).toContain("Steal Config");
    expect(exploit.attackDescription).toContain("Remote Path");
  });

  it("carries the path's mitigations as drafts", () => {
    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(SIMPLE_TREE),
      opts({ policy: "all" }),
    );

    const exploit = threats.find((t) => t.attackDescription.includes("Exploit API"))!;
    expect(exploit.proposedMitigations.map((m) => m.id)).toEqual(["M-001"]);
  });

  it("links the anchor's asset", () => {
    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(SIMPLE_TREE),
      opts({ policy: "all" }),
    );

    expect(threats[0].linkedAssetIds).toEqual(["A-001"]);
  });

  it("REGRESSION: the threat id embeds the stable pathKey", () => {
    // This is what keeps a confirm decision, a risk rating and a Jira link
    // attached to the right path across DSL edits (Phase 1).
    const tree = makeTree(SIMPLE_TREE);
    const exploitPath = tree.pathAnalysis!.paths.find((p) =>
      p.path.includes("Exploit API"),
    )!;

    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      tree,
      opts({ policy: "all" }),
    );

    const exploit = threats.find((t) => t.attackDescription.includes("Exploit API"))!;
    expect(exploit.id).toBe(`AT-at-1-${exploitPath.pathKey}-I`);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// destruction → TWO threats
// ──────────────────────────────────────────────────────────────────────────

describe("one path × one STRIDE category = one threat", () => {
  it("REGRESSION: a `destruction` path emits TWO threats (T and D)", () => {
    // ATTACK_GOAL_TO_STRIDE maps destruction onto BOTH T and D: a destructive
    // attack compromises integrity AND availability. Those are two different
    // threats — they may violate different security goals of the asset and need
    // different controls. One threat claiming to be both cannot be treated
    // cleanly in the register.
    const tree = makeTree(
      ["Wipe Config [A-001];ROOT @destruction", "\tDelete Store;p=0.8,i=4"].join(
        "\n",
      ),
    );

    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      tree,
      opts({ policy: "all" }),
    );

    expect(threats).toHaveLength(2);
    expect(threats.map((t) => t.strideCategory).sort()).toEqual(["D", "T"]);
  });

  it("both destruction threats trace back to the SAME path", () => {
    const tree = makeTree(
      ["Wipe Config [A-001];ROOT @destruction", "\tDelete Store;p=0.8,i=4"].join(
        "\n",
      ),
    );
    const pathKey = tree.pathAnalysis!.paths[0].pathKey;

    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      tree,
      opts({ policy: "all" }),
    );

    expect(threats.map((t) => t.id).sort()).toEqual(
      [`AT-at-1-${pathKey}-D`, `AT-at-1-${pathKey}-T`].sort(),
    );
    // Same chain, so the analyst can see they are one attack, two threats.
    expect(threats[0].attackDescription).toBe(threats[1].attackDescription);
  });

  it("every other goal maps 1:1 and yields one threat", () => {
    const tree = makeTree(
      ["Tamper [A-001];ROOT @manipulation", "\tInject;p=0.8,i=4"].join("\n"),
    );

    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      tree,
      opts({ policy: "all" }),
    );

    expect(threats).toHaveLength(1);
    expect(threats[0].strideCategory).toBe("T");
  });

  it("REGRESSION: a path with no attack goal emits nothing and is reported as suppressed", () => {
    // No goal → no STRIDE category → the threat cannot be filed. Dropping it
    // silently would hide a modelling gap; suppressedPaths surfaces it.
    const tree = makeTree(["Root [A-001];ROOT", "\tLeaf;p=0.8,i=3"].join("\n"));

    const { threats, suppressedPaths } =
      attackTreeThreatGenerator.generateThreatsFromAttackTree(
        tree,
        opts({ policy: "all" }),
      );

    expect(threats).toEqual([]);
    expect(suppressedPaths).toHaveLength(1);
    expect(suppressedPaths[0].reason).toContain("no attack goal");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Only asset-anchored trees contribute to the register
// ──────────────────────────────────────────────────────────────────────────

describe("asset anchoring is required (ISO 3.1.33)", () => {
  it("REGRESSION: a standalone tree emits NO threats", () => {
    // A threat scenario is by definition the compromise of a property OF AN
    // ASSET. No asset → no threat scenario → no damage scenario → no impact →
    // no risk value. The tree stays legal and useful (15.6 is also invoked from
    // 8.5, vulnerability analysis); it just contributes nothing to the register.
    const tree = makeTree(SIMPLE_TREE, { type: "standalone" });

    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      tree,
      opts({ policy: "all" }),
    );

    expect(threats).toEqual([]);
  });

  it("REGRESSION: an 'asset' anchor with no assetId emits nothing", () => {
    // AttackTreeAnchor is a flat interface, so type === "asset" does NOT
    // guarantee assetId is set. Emitting from such a tree would put an
    // unattributable entry in the register.
    const tree = makeTree(SIMPLE_TREE, { type: "asset" }); // assetId missing

    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      tree,
      opts({ policy: "all" }),
    );

    expect(threats).toEqual([]);
  });

  it("a threat-anchored tree emits nothing either", () => {
    const tree = makeTree(SIMPLE_TREE, { type: "threat", threatId: "T-001" });

    expect(
      attackTreeThreatGenerator.generateThreatsFromAttackTree(
        tree,
        opts({ policy: "all" }),
      ).threats,
    ).toEqual([]);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Emission policy
// ──────────────────────────────────────────────────────────────────────────

describe("emission policy", () => {
  const TWO_GOALS = [
    "Attack Config [A-001];ROOT @disclosure",
    "\tRead Path;OR",
    "\t\tEasy Read;p=0.9,i=3",
    "\t\tHard Read;p=0.1,i=3",
    "\tTamper Path;OR @manipulation",
    "\t\tEasy Write;p=0.9,i=4",
    "\t\tHard Write;p=0.1,i=4",
  ].join("\n");

  it("'all' emits every rated path", () => {
    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(TWO_GOALS),
      opts({ policy: "all" }),
    );

    expect(threats.length).toBeGreaterThanOrEqual(4);
  });

  it("REGRESSION: 'cheapest-per-goal' keeps the count bounded — one route per goal", () => {
    // A realistic tree has 20–50 leaves. Emitting all of them would bury the
    // analyst without adding scenarios. 15.8 NOTE 2 gives the MAXIMUM as the
    // aggregation example: the attacker takes the easiest route.
    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(TWO_GOALS),
      opts({ policy: "cheapest-per-goal" }),
    );

    // The easy paths win; the hard ones are documented but not emitted.
    expect(
      threats.every((t) => /Easy/.test(t.attackDescription)),
    ).toBe(true);
    expect(threats.some((t) => /Hard/.test(t.attackDescription))).toBe(false);
  });

  it("'above-threshold' respects the feasibility floor", () => {
    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(TWO_GOALS),
      opts({ policy: "above-threshold", threshold: "high" }),
    );

    expect(threats.every((t) => /Easy/.test(t.attackDescription))).toBe(true);
  });

  it("non-emitted paths are REPORTED, not silently dropped", () => {
    // Silence looks like absence. The report lists them as documented-but-not-
    // risk-bearing, so an auditor sees the analysis was done.
    const { suppressedPaths } =
      attackTreeThreatGenerator.generateThreatsFromAttackTree(
        makeTree(TWO_GOALS),
        opts({ policy: "cheapest-per-goal" }),
      );

    expect(suppressedPaths.length).toBeGreaterThan(0);
    expect(
      suppressedPaths.some((s) => s.path.path.some((n) => /Hard/.test(n))),
    ).toBe(true);
  });

  it("REGRESSION: the cheapest path is deterministic when several tie", () => {
    // A wobbling "cheapest path" would change the emitted threat set between
    // runs, and the analyst's confirm decisions would drift off the paths they
    // were made about — defeating Phase 1's stable identity.
    const tied = [
      "Steal [A-001];ROOT @disclosure",
      "\tA;p=0.9,i=3",
      "\tB;p=0.9,i=3",
    ].join("\n");

    const first = attackTreeThreatGenerator
      .generateThreatsFromAttackTree(makeTree(tied), opts())
      .threats.map((t) => t.id);

    for (let i = 0; i < 5; i++) {
      expect(
        attackTreeThreatGenerator
          .generateThreatsFromAttackTree(makeTree(tied), opts())
          .threats.map((t) => t.id),
      ).toEqual(first);
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Unrated paths never become threats
// ──────────────────────────────────────────────────────────────────────────

describe("unrated paths", () => {
  it("REGRESSION: a path with no feasibility is NEVER emitted, under any policy", () => {
    // It would enter the register with no likelihood and sit there looking like
    // the safest thing in the project. The validator already warns about the
    // unrated leaf; the register must not paper over it by inventing a threat.
    const tree = makeTree(
      ["Steal [A-001];ROOT @disclosure", "\tGate;OR", "\t\tUnrated;OR"].join("\n"),
    );

    for (const policy of ["all", "cheapest-per-goal", "above-threshold"] as const) {
      const { threats, suppressedPaths } =
        attackTreeThreatGenerator.generateThreatsFromAttackTree(
          tree,
          opts({ policy, threshold: "very-low" }),
        );

      expect(threats).toEqual([]);
      expect(suppressedPaths[0].reason).toContain("not rated");
    }
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Benefit suppression — 62443 mode only
// ──────────────────────────────────────────────────────────────────────────

describe("negligible benefit suppression (IEC 62443 mode only)", () => {
  const POINTLESS = [
    "Steal [A-001];ROOT @disclosure",
    "\tEasy But Pointless;p=0.9,i=3,b=negligible",
    "\tWorthwhile;p=0.5,i=3,b=high",
  ].join("\n");

  it("suppresses a path nobody profits from, when enabled", () => {
    // An attack nobody profits from is not a reasonably foreseeable scenario.
    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(POINTLESS),
      opts({ policy: "all", suppressNegligibleBenefit: true }),
    );

    expect(threats.some((t) => /Pointless/.test(t.attackDescription))).toBe(false);
    expect(threats.some((t) => /Worthwhile/.test(t.attackDescription))).toBe(true);
  });

  it("REGRESSION: does NOT suppress in ISO mode (the default)", () => {
    // In ISO 21434, benefit has no bearing on the register (Cl. 3.1.29).
    // Dropping a path for lack of attacker motive would be exactly the
    // "nobody would bother" reasoning the standard forecloses.
    const { threats } = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(POINTLESS),
      opts({ policy: "all" }), // suppressNegligibleBenefit defaults to false
    );

    expect(threats.some((t) => /Pointless/.test(t.attackDescription))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Purity — what makes Phase 5's sync possible
// ──────────────────────────────────────────────────────────────────────────

describe("the generator is pure", () => {
  it("produces identical threats for identical input", () => {
    const a = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(SIMPLE_TREE),
      opts(),
    );
    const b = attackTreeThreatGenerator.generateThreatsFromAttackTree(
      makeTree(SIMPLE_TREE),
      opts(),
    );

    expect(a.threats.map((t) => t.id)).toEqual(b.threats.map((t) => t.id));
  });

  it("does not mutate the tree", () => {
    const tree = makeTree(SIMPLE_TREE);
    const before = JSON.stringify(tree);

    attackTreeThreatGenerator.generateThreatsFromAttackTree(tree, opts());

    expect(JSON.stringify(tree)).toBe(before);
  });

  it("a tree with no paths yields nothing rather than throwing", () => {
    const tree = makeTree(SIMPLE_TREE);
    const empty = { ...tree, pathAnalysis: undefined } as AttackTree;

    expect(
      attackTreeThreatGenerator.generateThreatsFromAttackTree(empty, opts())
        .threats,
    ).toEqual([]);
  });
});