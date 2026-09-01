// src/tests/unit/features/dfd/hooks/asset-group-change.characterization.test.ts
//
// Phase 5 NET (asset-store-ssot-refactor-v2). Pins the CURRENT behaviour of an
// asset group change before Phase 5 changes it. It asserts what the code does
// today, NOT what it should do.
//
// Today (use-dfd-data.updateAsset): changing an asset's group
//   - REGENERATES the asset id with the new group prefix (DA-001 → SY-001),
//     and sets displayId = the new id, and
//   - STRIPS every element/connection assetRelation that referenced the old id
//     (the links are lost — the analyst must re-link).
//
// Phase 5 decision (b) — mirror the Threat model — will change this to:
//   - id STAYS stable (the reference DFD elements point at), and
//   - displayId regenerates instead, and
//   - relations are PRESERVED (the stable id keeps them valid).
//
// When Phase 5b lands, THIS test must be updated consciously — that update is
// the signal the identity model flipped.

import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDFDData } from "features/dfd/hooks/use-dfd-data";
import type {
  DFDProjectData,
  DFDData,
  DFDElement,
} from "features/dfd/models/dfd-types";
import type { DFDAsset } from "features/dfd/models/dfd-asset-types";

const processEl = {
  id: "3",
  type: "Process",
  name: "MyProcess",
  displayId: "P-1",
  position: { x: 0, y: 0 },
  size: { width: 100, height: 60 },
  properties: {},
  assetRelations: [
    { assetId: "DA-001", assetGroup: "data", relationType: "creates" },
    { assetId: "DA-001", assetGroup: "data", relationType: "is_an" },
  ],
} as unknown as DFDElement;

const dataAsset = {
  id: "DA-001",
  displayId: "DA-001",
  name: "Config Data",
  assetGroup: "data",
  linkedElements: [],
} as unknown as DFDAsset;

function makeProject(): DFDProjectData {
  const dfd = {
    xml: "<mxGraphModel><root></root></mxGraphModel>",
    elements: [processEl],
    connections: [],
    assets: [dataAsset],
  } as unknown as DFDData;

  return {
    id: "proj-group-change",
    name: "group change char",
    dfd,
    phaseStatus: {} as never,
    settings: { autoSave: true, autoSaveInterval: 2 },
    lastModified: new Date().toISOString(),
  };
}

describe("asset group change — stable-id model (Phase 5b)", () => {
  it("keeps the asset id stable and regenerates only the displayId", () => {
    const { result } = renderHook(() => useDFDData(makeProject()));
    const next = result.current.updateAsset("DA-001", {
      assetGroup: "system",
    });

    const asset = next.assets.find((a) => a.id === "DA-001")!;
    expect(asset).toBeDefined(); // id is stable — still found by DA-001
    expect(asset.assetGroup).toBe("system");
    // displayId is regenerated with the new group prefix.
    expect(asset.displayId).not.toBe("DA-001");
    expect(asset.displayId).toMatch(/^SY-/);
  });

  it("strips relations whose type is invalid for the new group, keeps compatible ones (B)", () => {
    const { result } = renderHook(() => useDFDData(makeProject()));
    const next = result.current.updateAsset("DA-001", {
      assetGroup: "system",
    });

    const rels = next.elements.find((e) => e.id === "3")!.assetRelations ?? [];

    // "creates" is a data-family relation type — invalid for a system asset →
    // stripped.
    expect(rels.some((r) => r.relationType === "creates")).toBe(false);

    // "is_an" is universal — kept, and its cached assetGroup follows the asset
    // to the new group (no drift).
    const isAn = rels.find((r) => r.relationType === "is_an");
    expect(isAn).toBeDefined();
    expect(isAn!.assetGroup).toBe("system");
  });

  it("leaves id/relations untouched when the group does NOT change", () => {
    const { result } = renderHook(() => useDFDData(makeProject()));
    const next = result.current.updateAsset("DA-001", {
      name: "Renamed Config",
    });

    const asset = next.assets.find((a) => a.id === "DA-001")!;
    expect(asset).toBeDefined();
    expect(asset.name).toBe("Renamed Config");

    const el = next.elements.find((e) => e.id === "3")!;
    expect(
      (el.assetRelations ?? []).some((r) => r.assetId === "DA-001"),
    ).toBe(true);
  });
});
