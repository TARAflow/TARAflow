// Mirror of src/features/audit/services/diff-service.ts
// Place at: src/tests/unit/features/audit/services/diff-service.test.ts
//
// Focus: a phase (assets/threats/risks/attack-trees) going from null -> populated
// (or the reverse) must be a committable change, and asset detail must detect
// impact-rating, security-goal (by LEVEL, not a non-existent `enabled` flag) and
// asset<->DFD relation (linkedDFDElements) changes. Fixtures are minimal and cast
// to the project shape — we exercise DiffService behaviour, not the feature types.

import { describe, it, expect } from "vitest";
import { DiffService } from "features/audit/services/diff-service";
import type { Project } from "app";
import type { PhaseChanges } from "features/audit/models/audit-types";

const svc = new DiffService();

// ---- fixtures ----
const anAsset = (over: Record<string, any> = {}) => ({
  id: "DA-001",
  name: "Meassure Data",
  overallImpact: 0,
  properties: { description: "", protectionNeed: "low" },
  impactRatings: [
    { criterionId: "financial_damage", value: null },
    { criterionId: "operational", value: null },
  ],
  securityGoals: [
    { type: "C", level: "none", formalDescription: "" },
    { type: "I", level: "none", formalDescription: "" },
  ],
  linkedDFDElements: [
    {
      displayId: "DS-2",
      elementId: "el-16",
      elementName: "Local Measurements",
      elementType: "DataStore",
      relationType: "stores",
    },
  ],
  ...over,
});

const project = (over: Record<string, any> = {}): Project =>
  ({
    dfd: null,
    assets: null,
    threats: null,
    risks: null,
    attackTrees: null,
    ...over,
  }) as unknown as Project;

const assetPhase = (changes: PhaseChanges[]) =>
  changes.find((p) => p.phase === "assets");

describe("DiffService — phase null-transitions are committable", () => {
  it("assets null -> populated yields one granular 'added' item per asset", () => {
    const prev = project({ assets: null }); // previous committed had assets: null
    const cur = project({
      assets: { assets: [anAsset(), anAsset({ id: "DA-005", name: "Config" })] },
    });

    const p = assetPhase(svc.detectChanges(cur, prev));
    expect(p).toBeDefined();
    expect(p!.changeCount).toBe(2);
    expect(p!.changes.every((c) => c.type === "added")).toBe(true);
    // Granular ids feed a meaningful commit message.
    expect(p!.changes.map((c) => c.id).sort()).toEqual(["DA-001", "DA-005"]);
  });

  it("an added asset carries a Linked DFD Elements (relations) detail", () => {
    const prev = project({ assets: null });
    const cur = project({ assets: { assets: [anAsset()] } }); // has 1 link
    const item = assetPhase(svc.detectChanges(cur, prev))!.changes[0];
    expect(item.type).toBe("added");
    const d = item.details!.find((x) => x.field === "linkedDFDElements");
    expect(d).toBeDefined();
    expect(d!.newValue).toBe(1);
  });

  it("assets populated -> null yields a 'deleted' item", () => {
    const prev = project({ assets: { assets: [anAsset()] } });
    const cur = project({ assets: null });

    const p = assetPhase(svc.detectChanges(cur, prev));
    expect(p!.changeCount).toBe(1);
    expect(p!.changes[0].type).toBe("deleted");
  });

  it("threats / risks / attack-trees first population are each committable", () => {
    const cur = project({
      threats: {
        configuration: { activeMethod: "per-element" },
        perElementTables: [
          {
            threats: [
              {
                id: "T-1",
                strideCategory: "S",
                threatDescription: "spoof",
                attackDescription: "a",
              },
            ],
          },
        ],
        perInteractionTables: [],
      },
      risks: {
        risks: [
          {
            id: "R-1",
            strideCategory: "S",
            threatDescription: "d",
            calculatedRiskBeforeMitigation: 1,
            calculatedRiskAfterMitigation: 1,
            moscowPriority: "must",
            selectedMitigations: [],
          },
        ],
      },
      attackTrees: { trees: [{ id: "AT-1", name: "Tree", description: "", dsl: "x" }] },
    });
    const prev = project({ threats: null, risks: null, attackTrees: null });

    const changes = svc.detectChanges(cur, prev);
    expect(changes.find((p) => p.phase === "threats")!.changeCount).toBe(1);
    expect(changes.find((p) => p.phase === "risks")!.changeCount).toBe(1);
    expect(changes.find((p) => p.phase === "attacktrees")!.changeCount).toBe(1);
  });
});

describe("DiffService — asset detail detection", () => {
  it("detects an impact-rating value change (null -> value)", () => {
    const prev = project({ assets: { assets: [anAsset()] } });
    const cur = project({
      assets: {
        assets: [
          anAsset({
            impactRatings: [
              { criterionId: "financial_damage", value: 3 },
              { criterionId: "operational", value: null },
            ],
          }),
        ],
      },
    });

    const item = assetPhase(svc.detectChanges(cur, prev))!.changes[0];
    expect(item.type).toBe("modified");
    expect(item.details!.some((d) => d.field === "impactRatings")).toBe(true);
  });

  it("detects a security-goal LEVEL change (none -> high), not just enable/disable", () => {
    const prev = project({ assets: { assets: [anAsset()] } });
    const cur = project({
      assets: {
        assets: [
          anAsset({
            securityGoals: [
              { type: "C", level: "high", formalDescription: "" },
              { type: "I", level: "none", formalDescription: "" },
            ],
          }),
        ],
      },
    });

    const item = assetPhase(svc.detectChanges(cur, prev))!.changes[0];
    const d = item.details!.find((x) => x.field === "securityGoals");
    expect(d).toBeDefined();
    expect(String(d!.oldValue)).toContain("C:none");
    expect(String(d!.newValue)).toContain("C:high");
  });

  it("detects an asset<->DFD relation added on an existing asset (linkedDFDElements only)", () => {
    const prev = project({ assets: { assets: [anAsset()] } });
    const cur = project({
      assets: {
        assets: [
          anAsset({
            linkedDFDElements: [
              {
                displayId: "DS-2",
                elementId: "el-16",
                elementName: "Local Measurements",
                elementType: "DataStore",
                relationType: "stores",
              },
              {
                displayId: "DF-18",
                elementId: "el-44",
                elementName: "push sync",
                elementType: "DataFlow",
                relationType: "transports",
              },
            ],
          }),
        ],
      },
    });

    const p = assetPhase(svc.detectChanges(cur, prev))!;
    expect(p.changeCount).toBe(1);
    expect(p.changes[0].type).toBe("modified");
    expect(
      p.changes[0].details!.some((d) => d.field === "linkedDFDElements"),
    ).toBe(true);
  });

  it("no false positive: identical assets produce no Assets phase", () => {
    const prev = project({ assets: { assets: [anAsset()] } });
    const cur = project({ assets: { assets: [anAsset()] } });
    expect(assetPhase(svc.detectChanges(cur, prev))).toBeUndefined();
  });

  it("ignores display-only relation fields (elementName/displayId) — no spurious change", () => {
    const prev = project({ assets: { assets: [anAsset()] } });
    const cur = project({
      assets: {
        assets: [
          anAsset({
            linkedDFDElements: [
              {
                displayId: "XX-9", // display fields differ...
                elementId: "el-16", // ...but identity (elementId+relationType) is same
                elementName: "renamed",
                elementType: "DataStore",
                relationType: "stores",
              },
            ],
          }),
        ],
      },
    });
    expect(assetPhase(svc.detectChanges(cur, prev))).toBeUndefined();
  });
});