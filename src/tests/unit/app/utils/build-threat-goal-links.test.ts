// tests/unit/app/utils/build-threat-goal-links.test.ts
//
// Security-goal rework, Phase 6: the app layer projects the threats for the
// threat ↔ goal cross-checks of the asset tab — same generators and the same
// threat → asset link rule as the risk register; dismissed threats left out.

import { describe, expect, it } from "vitest";
import { buildThreatGoalLinks } from "app/utils/build-threat-goal-links";

const threat = (id: string, stride: string, extra: Record<string, unknown> = {}) => ({
  id,
  displayId: id,
  strideCategory: stride,
  linkedElement: null,
  dataFlow: null,
  ...extra,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const data = (pe: any[], pi: any[] = []): any => ({
  perElementTables: [{ threats: pe }],
  perInteractionTables: [{ threats: pi }],
});

const assets = [
  { id: "a1", linkedDFDElements: [{ elementId: "P-1" }] },
  { id: "a2", linkedDFDElements: [{ elementId: "DF-1" }] },
];
const dfdElements = [{ id: "P-1", assetRelations: [{ assetId: "a3", relationType: "is_an" }] }];

describe("buildThreatGoalLinks", () => {
  const base = { assets, dfdElements, attackTrees: null };

  it("projects both STRIDE tables with their linked assets", () => {
    const links = buildThreatGoalLinks({
      ...base,
      threats: data(
        [threat("e1", "T", { linkedElement: { elementId: "P-1" } })],
        [threat("i1", "I", { dataFlow: { connectionId: "DF-1" } })],
      ),
      disabledStrideMethods: [],
    });
    expect(links).toEqual([
      { id: "e1", displayId: "e1", strideCategory: "T", linkedAssetIds: ["a1", "a3"] },
      { id: "i1", displayId: "i1", strideCategory: "I", linkedAssetIds: ["a2"] },
    ]);
  });

  it("dismissed threats and disabled generators are left out; unrated / uncertain stay", () => {
    const links = buildThreatGoalLinks({
      ...base,
      threats: data(
        [
          threat("e1", "T", { relevance: "not_relevant" }),
          threat("e2", "T", { relevance: "uncertain" }),
          threat("e3", "T"),
        ],
        [threat("i1", "I")],
      ),
      disabledStrideMethods: ["per-interaction"],
    });
    expect(links.map((l) => l.id)).toEqual(["e2", "e3"]);
  });

  it("no threat data → no links", () => {
    expect(buildThreatGoalLinks({ ...base, threats: null, disabledStrideMethods: [] })).toEqual([]);
  });
});
