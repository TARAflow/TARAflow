// tests/unit/features/attacktree/services/attacktree-path-identity.test.ts
//
// PHASE 1 — the property these tests protect:
//
//   An analyst confirms 40 attack-path threats, rates them, links Jira tickets.
//   Then they add one line to the DSL.
//
// With the old enumeration ids ("path-1", "path-2", ...) every subsequent id
// shifted and all of that work silently reattached to the WRONG path. No error,
// no warning — just a corrupted risk register.
//
// So the tests are written as invariants, not as "does the function return a
// string": edit the tree in every way that must NOT disturb identity, and
// assert the key is unchanged. Then edit it in the way that MUST disturb it.

import { describe, it, expect } from "vitest";
import { attackTreeParser } from "features/attacktree/services/attacktree-parser";
import { attackTreeCalculator } from "features/attacktree/services/attacktree-calculator";
import {
  computePathKey,
  computePathKeyFromPath,
  buildAttackPathThreatId,
  findPathKeyCollisions,
  diffPathAnalysis,
} from "features/attacktree/services/attacktree-path-identity";

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

function analyse(dsl: string) {
  const ast = attackTreeParser.parse(dsl, "simple").ast!;
  return attackTreeCalculator.analyzeAttackPaths(ast, "simple");
}

/** Key of the path ending in `leafName`. Fails loudly if it isn't there. */
function keyOfLeaf(dsl: string, leafName: string): string {
  const analysis = analyse(dsl);
  const path = analysis.paths.find(
    (p) => p.path[p.path.length - 1] === leafName,
  );
  if (!path) {
    throw new Error(
      `no path ending in "${leafName}" — found: ${analysis.paths
        .map((p) => p.path[p.path.length - 1])
        .join(", ")}`,
    );
  }
  return path.pathKey;
}

const BASE = [
  "Steal Config [A-001];ROOT @disclosure",
  "\tRemote Path;OR",
  "\t\tExploit API;p=0.5,i=3 [M-001]",
  "\t\tSniff Traffic;p=0.2,i=2 [M-002]",
].join("\n");

// ──────────────────────────────────────────────────────────────────────────
// Stability — the whole point
// ──────────────────────────────────────────────────────────────────────────

describe("computePathKey — stable under unrelated edits", () => {
  it("REGRESSION: inserting a sibling branch does not disturb existing keys", () => {
    // This is the exact edit that used to corrupt everything: the new branch
    // pushes "Sniff Traffic" from path-2 to path-3 under the old scheme.
    const before = keyOfLeaf(BASE, "Sniff Traffic");

    const withNewBranch = [
      "Steal Config [A-001];ROOT @disclosure",
      "\tRemote Path;OR",
      "\t\tExploit API;p=0.5,i=3 [M-001]",
      "\t\tBrute Force Login;p=0.4,i=3", // ← inserted BEFORE Sniff Traffic
      "\t\tSniff Traffic;p=0.2,i=2 [M-002]",
    ].join("\n");

    expect(keyOfLeaf(withNewBranch, "Sniff Traffic")).toBe(before);
  });

  it("reordering sibling branches does not disturb keys", () => {
    const reordered = [
      "Steal Config [A-001];ROOT @disclosure",
      "\tRemote Path;OR",
      "\t\tSniff Traffic;p=0.2,i=2 [M-002]", // swapped
      "\t\tExploit API;p=0.5,i=3 [M-001]",
    ].join("\n");

    expect(keyOfLeaf(reordered, "Exploit API")).toBe(
      keyOfLeaf(BASE, "Exploit API"),
    );
    expect(keyOfLeaf(reordered, "Sniff Traffic")).toBe(
      keyOfLeaf(BASE, "Sniff Traffic"),
    );
  });

  it("adding comments and blank lines does not disturb keys", () => {
    const commented = [
      "# Attack tree for the config store",
      "",
      "Steal Config [A-001];ROOT @disclosure",
      "\tRemote Path;OR",
      "# the cheap way in",
      "\t\tExploit API;p=0.5,i=3 [M-001]",
      "",
      "\t\tSniff Traffic;p=0.2,i=2 [M-002]",
    ].join("\n");

    expect(keyOfLeaf(commented, "Exploit API")).toBe(
      keyOfLeaf(BASE, "Exploit API"),
    );
  });

  it("re-rating a leaf does not disturb its key", () => {
    // Feasibility/impact are assessments ABOUT the path, not the path's identity.
    const rerated = BASE.replace("Exploit API;p=0.5,i=3", "Exploit API;p=0.9,i=4");

    expect(keyOfLeaf(rerated, "Exploit API")).toBe(keyOfLeaf(BASE, "Exploit API"));
  });

  it("changing mitigations does not disturb the key", () => {
    const remitigated = BASE.replace("[M-001]", "[M-007,M-008]");

    expect(keyOfLeaf(remitigated, "Exploit API")).toBe(
      keyOfLeaf(BASE, "Exploit API"),
    );
  });

  it("cosmetic whitespace inside a node name does not disturb the key", () => {
    // A stray double space from a paste must not orphan an assessment.
    expect(computePathKey(["Steal  Config", "Remote   Path"])).toBe(
      computePathKey(["Steal Config", "Remote Path"]),
    );
    expect(computePathKey([" Steal Config ", "Remote Path"])).toBe(
      computePathKey(["Steal Config", "Remote Path"]),
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Sensitivity — identity MUST break when the scenario changes
// ──────────────────────────────────────────────────────────────────────────

describe("computePathKey — changes when the scenario changes", () => {
  it("renaming a leaf changes its key", () => {
    // A renamed step is a different scenario. It must NOT silently inherit the
    // old rating — the analyst has to look at it again.
    const renamed = BASE.replace("Exploit API", "Exploit GraphQL API");

    expect(keyOfLeaf(renamed, "Exploit GraphQL API")).not.toBe(
      keyOfLeaf(BASE, "Exploit API"),
    );
  });

  it("renaming an intermediate node changes the keys of all paths below it", () => {
    const renamed = BASE.replace("Remote Path", "Network Path");

    expect(keyOfLeaf(renamed, "Exploit API")).not.toBe(
      keyOfLeaf(BASE, "Exploit API"),
    );
    expect(keyOfLeaf(renamed, "Sniff Traffic")).not.toBe(
      keyOfLeaf(BASE, "Sniff Traffic"),
    );
  });

  it("re-parenting a leaf changes its key", () => {
    // Same leaf name, different route to it = different attack path.
    const reparented = [
      "Steal Config [A-001];ROOT @disclosure",
      "\tPhysical Path;OR",
      "\t\tExploit API;p=0.5,i=3 [M-001]",
    ].join("\n");

    expect(keyOfLeaf(reparented, "Exploit API")).not.toBe(
      keyOfLeaf(BASE, "Exploit API"),
    );
  });

  it("case is significant — 'extract data' is not 'Extract Data'", () => {
    expect(computePathKey(["Root", "Extract Data"])).not.toBe(
      computePathKey(["Root", "extract data"]),
    );
  });

  it("the chain is order-sensitive", () => {
    expect(computePathKey(["A", "B"])).not.toBe(computePathKey(["B", "A"]));
  });

  it("segment boundaries cannot be forged by concatenation", () => {
    // ["AB"] and ["A","B"] must not collide — otherwise a rename could
    // accidentally reproduce another path's key.
    expect(computePathKey(["AB"])).not.toBe(computePathKey(["A", "B"]));
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Determinism + collisions
// ──────────────────────────────────────────────────────────────────────────

describe("computePathKey — determinism and collisions", () => {
  it("is deterministic across calls", () => {
    const chain = ["Steal Config", "Remote Path", "Exploit API"];
    expect(computePathKey(chain)).toBe(computePathKey(chain));
  });

  it("produces a compact hex key", () => {
    expect(computePathKey(["Root", "Leaf"])).toMatch(/^[0-9a-f]{12}$/);
  });

  it("no collisions across a realistically sized tree", () => {
    // 3 gates x 8 leaves = 24 distinct paths, plus deep nesting.
    const lines = ["Compromise Plant [A-001];ROOT @disclosure"];
    for (let g = 0; g < 3; g++) {
      lines.push(`\tVector ${g};OR`);
      for (let l = 0; l < 8; l++) {
        lines.push(`\t\tStep ${g}-${l};p=0.5,i=3`);
      }
    }
    const analysis = analyse(lines.join("\n"));

    expect(analysis.paths).toHaveLength(24);
    expect(findPathKeyCollisions(analysis.paths)).toEqual([]);

    const keys = new Set(analysis.paths.map((p) => p.pathKey));
    expect(keys.size).toBe(24);
  });

  it("computePathKeyFromPath agrees with computePathKey", () => {
    const path = analyse(BASE).paths[0];
    expect(computePathKeyFromPath(path)).toBe(computePathKey(path.path));
  });
});

describe("buildAttackPathThreatId", () => {
  it("composes tree id and path key", () => {
    expect(buildAttackPathThreatId("at-3", "0a1b2c3d4e5f")).toBe(
      "AT-at-3-0a1b2c3d4e5f",
    );
  });
});

// ──────────────────────────────────────────────────────────────────────────
// The `id` field must NOT be mistaken for identity
// ──────────────────────────────────────────────────────────────────────────

describe("AttackPath.id vs AttackPath.pathKey", () => {
  it("id renumbers on insertion but pathKey does not — the bug in one test", () => {
    const before = analyse(BASE);
    const sniffBefore = before.paths.find(
      (p) => p.path[p.path.length - 1] === "Sniff Traffic",
    )!;

    const withNewBranch = [
      "Steal Config [A-001];ROOT @disclosure",
      "\tRemote Path;OR",
      "\t\tExploit API;p=0.5,i=3 [M-001]",
      "\t\tBrute Force Login;p=0.4,i=3",
      "\t\tSniff Traffic;p=0.2,i=2 [M-002]",
    ].join("\n");

    const after = analyse(withNewBranch);
    const sniffAfter = after.paths.find(
      (p) => p.path[p.path.length - 1] === "Sniff Traffic",
    )!;

    expect(sniffAfter.id).not.toBe(sniffBefore.id); // ← the old, broken identity
    expect(sniffAfter.pathKey).toBe(sniffBefore.pathKey); // ← the new, stable one
  });
});

// ──────────────────────────────────────────────────────────────────────────
// Class A / Class B change detection
// ──────────────────────────────────────────────────────────────────────────

describe("diffPathAnalysis — Class A (silent) vs Class B (banner)", () => {
  const WITH_EXTRA = [
    "Steal Config [A-001];ROOT @disclosure",
    "\tRemote Path;OR",
    "\t\tExploit API;p=0.5,i=3 [M-001]",
    "\t\tSniff Traffic;p=0.2,i=2 [M-002]",
    "\t\tBrute Force Login;p=0.4,i=3",
  ].join("\n");

  it("a new path is Class A — additive, nothing is at stake", () => {
    const diff = diffPathAnalysis(analyse(BASE), analyse(WITH_EXTRA));

    expect(diff.requiresBanner).toBe(false);
    const added = diff.changes.filter((c) => c.kind === "added");
    expect(added).toHaveLength(1);
    expect(added[0].changeClass).toBe("A");
    expect(added[0].chain).toContain("Brute Force Login");
  });

  it("removing a path nobody assessed is Class A — no work is lost", () => {
    const diff = diffPathAnalysis(
      analyse(WITH_EXTRA),
      analyse(BASE),
      new Set(), // nothing assessed
    );

    expect(diff.requiresBanner).toBe(false);
    expect(diff.changes.every((c) => c.changeClass === "A")).toBe(true);
  });

  it("REGRESSION: removing a path the analyst ASSESSED is Class B — banner, never silent", () => {
    // This is the case that must never be swallowed: their confirm/dismiss,
    // rating and Jira link hang on this key.
    const doomedKey = keyOfLeaf(WITH_EXTRA, "Brute Force Login");

    const diff = diffPathAnalysis(
      analyse(WITH_EXTRA),
      analyse(BASE),
      new Set([doomedKey]),
    );

    expect(diff.requiresBanner).toBe(true);
    const removed = diff.changes.find((c) => c.kind === "removed")!;
    expect(removed.changeClass).toBe("B");
    expect(removed.pathKey).toBe(doomedKey);
  });

  it("renaming an assessed node surfaces as Class B removal + Class A addition", () => {
    // The rename severs identity by design. The analyst must see that their
    // assessment no longer has a home, rather than have it silently migrate.
    const assessedKey = keyOfLeaf(BASE, "Exploit API");
    const renamed = BASE.replace("Exploit API", "Exploit GraphQL API");

    const diff = diffPathAnalysis(
      analyse(BASE),
      analyse(renamed),
      new Set([assessedKey]),
    );

    expect(diff.requiresBanner).toBe(true);
    expect(
      diff.changes.some((c) => c.kind === "removed" && c.changeClass === "B"),
    ).toBe(true);
    expect(
      diff.changes.some((c) => c.kind === "added" && c.changeClass === "A"),
    ).toBe(true);
  });

  it("an unrelated edit produces no changes at all", () => {
    const rerated = BASE.replace("p=0.5,i=3", "p=0.9,i=4");
    const assessed = new Set(analyse(BASE).paths.map((p) => p.pathKey));

    const diff = diffPathAnalysis(analyse(BASE), analyse(rerated), assessed);

    expect(diff.changes).toEqual([]);
    expect(diff.requiresBanner).toBe(false);
  });

  it("handles a tree appearing or disappearing entirely", () => {
    expect(diffPathAnalysis(undefined, analyse(BASE)).changes).toHaveLength(2);
    expect(diffPathAnalysis(analyse(BASE), undefined).changes).toHaveLength(2);
    expect(diffPathAnalysis(undefined, undefined).changes).toEqual([]);
  });
});
