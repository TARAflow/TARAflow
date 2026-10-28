// tests/unit/app/utils/build-item-model-items.test.ts
//
// ISO/SAE 21434 conformance plan Phase 1 stage A, A-2: the model items a
// Definition section can link to — DFD elements, flows, pages, assets, each
// sorted by display id.

import { describe, it, expect } from "vitest";
import { buildItemModelItems } from "app/utils/build-item-model-items";

describe("buildItemModelItems", () => {
  it("elements, flows, pages, assets — labelled with display id and name", () => {
    const items = buildItemModelItems({
      dfd: {
        elements: [
          { id: "e2", displayId: "P-2", name: "Evaluate", type: "Process" },
          { id: "e1", displayId: "EE-1", name: "Operator", type: "ExternalEntity" },
        ],
        connections: [{ id: "c1", displayId: "DF-1", name: "push alarm" }],
        pages: [{ pageId: "sys", name: "System" }],
      },
      assets: { assets: [{ id: "a1", displayId: "FU-001", name: "Detect smoke", assetGroup: "function" }] },
    } as never);
    expect(items).toEqual([
      { id: "e1", kind: "element", label: "EE-1 Operator", detail: "ExternalEntity" },
      { id: "e2", kind: "element", label: "P-2 Evaluate", detail: "Process" },
      { id: "c1", kind: "flow", label: "DF-1 push alarm" },
      { id: "sys", kind: "page", label: "System" },
      { id: "a1", kind: "asset", label: "FU-001 Detect smoke", detail: "function" },
    ]);
  });

  it("an empty project has none", () => {
    expect(buildItemModelItems({ dfd: null, assets: null } as never)).toEqual([]);
  });
});
