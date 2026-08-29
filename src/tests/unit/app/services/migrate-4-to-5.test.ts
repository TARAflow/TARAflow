// ==================== SCHEMA MIGRATION 4 → 5 ====================
// Pins the threat identity split and the cross-feature FK repoint:
//   - every threat gets an opaque UUID id; its old label moves to displayId
//   - Risk.threatId / AttackTreeAnchor.threatId are repointed to that UUID
//   - the old label is snapshotted as *.threatDisplayId for display/grouping
//   - idempotent (a second pass, or an already-v5 file, changes nothing further)

import { describe, it, expect } from "vitest";
import { migrate_4_to_5 } from "../../../../app/services/versions/migrate-4-to-5";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function v4Project() {
  return {
    schemaVersion: 4,
    threats: {
      configuration: {},
      perElementTables: [
        {
          trustBoundaryId: null,
          threats: [
            { id: "P1-S-1", displayId: undefined, strideCategory: "S" },
            { id: "P1-T-1", displayId: undefined, strideCategory: "T" },
          ],
        },
      ],
      perInteractionTables: [
        {
          trustBoundaryId: null,
          threats: [{ id: "DF1-I-IN-1", strideCategory: "I" }],
        },
      ],
    },
    risks: {
      risks: [
        { id: "R-P1-S-1", threatId: "P1-S-1", moscowPriority: "should" },
        { id: "R-DF1-I-IN-1", threatId: "DF1-I-IN-1" },
        // Orphan: references a threat that no longer exists.
        { id: "R-GONE", threatId: "GONE-S-9" },
      ],
    },
    attackTrees: {
      trees: [
        { id: "t1", anchor: { type: "threat", threatId: "P1-T-1" } },
        { id: "t2", anchor: { type: "asset", assetId: "a1" } },
      ],
    },
  };
}

describe("migrate_4_to_5 — threat identity split", () => {
  it("gives every threat a UUID id and moves the old label to displayId", () => {
    const out = migrate_4_to_5(v4Project());
    const el = out.threats.perElementTables[0].threats;
    expect(el[0].displayId).toBe("P1-S-1");
    expect(UUID_RE.test(el[0].id)).toBe(true);
    expect(el[1].displayId).toBe("P1-T-1");
    expect(UUID_RE.test(el[1].id)).toBe(true);
    const inter = out.threats.perInteractionTables[0].threats[0];
    expect(inter.displayId).toBe("DF1-I-IN-1");
    expect(UUID_RE.test(inter.id)).toBe(true);
    expect(out.schemaVersion).toBe(5);
  });

  it("repoints Risk.threatId to the new UUID and snapshots the label", () => {
    const out = migrate_4_to_5(v4Project());
    const uuidOfP1S1 = out.threats.perElementTables[0].threats[0].id;
    const risk = out.risks.risks.find((r: any) => r.id === "R-P1-S-1");
    expect(risk.threatId).toBe(uuidOfP1S1);
    expect(risk.threatDisplayId).toBe("P1-S-1");
  });

  it("repoints AttackTreeAnchor.threatId and snapshots the label", () => {
    const out = migrate_4_to_5(v4Project());
    const uuidOfP1T1 = out.threats.perElementTables[0].threats[1].id;
    const tree = out.attackTrees.trees.find((t: any) => t.id === "t1");
    expect(tree.anchor.threatId).toBe(uuidOfP1T1);
    expect(tree.anchor.threatDisplayId).toBe("P1-T-1");
    // Non-threat anchors are untouched.
    const asset = out.attackTrees.trees.find((t: any) => t.id === "t2");
    expect(asset.anchor.threatId).toBeUndefined();
  });

  it("leaves an orphaned risk's FK intact but still snapshots its label", () => {
    const out = migrate_4_to_5(v4Project());
    const orphan = out.risks.risks.find((r: any) => r.id === "R-GONE");
    expect(orphan.threatId).toBe("GONE-S-9"); // no matching threat → unchanged
    expect(orphan.threatDisplayId).toBe("GONE-S-9");
  });

  it("is idempotent — a second pass changes nothing", () => {
    const once = migrate_4_to_5(v4Project());
    const twice = migrate_4_to_5({ ...once, schemaVersion: 4 });
    expect(twice.threats.perElementTables[0].threats[0].id).toBe(
      once.threats.perElementTables[0].threats[0].id,
    );
    expect(twice.risks.risks[0].threatId).toBe(once.risks.risks[0].threatId);
    expect(twice.attackTrees.trees[0].anchor.threatId).toBe(
      once.attackTrees.trees[0].anchor.threatId,
    );
    expect(twice.risks.risks[0].threatDisplayId).toBe("P1-S-1");
  });

  it("handles a project with no risks or attack trees", () => {
    const out = migrate_4_to_5({
      schemaVersion: 4,
      threats: {
        perElementTables: [
          { threats: [{ id: "EE1-S-1", strideCategory: "S" }] },
        ],
        perInteractionTables: [],
      },
    });
    expect(UUID_RE.test(out.threats.perElementTables[0].threats[0].id)).toBe(
      true,
    );
    expect(out.schemaVersion).toBe(5);
  });
});
