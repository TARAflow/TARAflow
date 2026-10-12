// tests/unit/features/dfd/services/validators/asset-link-validator.test.ts
//
// Invalid asset-to-asset links are reported in the DFD tab's notification
// panel (where they are edited), at the source asset, as warnings. The link
// itself is never removed by validation.

import { describe, it, expect } from "vitest";
import { validateAssetLinks } from "features/dfd/services/validators/asset-link-validator";
import { DFDValidator } from "features/dfd/services/dfd-validator";
import type { ValidationFinding } from "features/dfd/models/dfd-types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const asset = (id: string, displayId: string, group: string, links: unknown[] = []): any => ({
  id,
  displayId,
  name: displayId,
  assetGroup: group,
  linkedElements: [],
  properties: {},
  assetRelations: links,
});

const link = (targetAssetId: string, relationType: string, id = `r-${targetAssetId}`) => ({
  id,
  targetAssetId,
  relationType,
});

function run(assets: unknown[]): ValidationFinding[] {
  const warnings: ValidationFinding[] = [];
  validateAssetLinks(assets as never, warnings);
  return warnings;
}

describe("validateAssetLinks", () => {
  it("a valid link yields nothing", () => {
    expect(
      run([asset("d", "DA-1", "data", [link("f", "required_by")]), asset("f", "FU-1", "function")]),
    ).toEqual([]);
  });

  it("a type the groups no longer allow is reported at the source asset", () => {
    expect(
      run([asset("d", "HU-1", "human", [link("f", "required_by")]), asset("f", "FU-1", "function")]),
    ).toEqual([
      {
        key: "dfdValidation.assetLink.type_not_allowed",
        displayId: "HU-1",
        elementId: "d",
        params: {
          name: "HU-1",
          relation: "required_by FU-1",
          sourceGroup: "human",
          targetGroup: "function",
        },
      },
    ]);
  });

  it("a link to a missing asset and a self link are reported", () => {
    const keys = run([
      asset("d", "DA-1", "data", [link("gone", "required_by"), link("d", "derives_from", "self")]),
    ]).map((w) => w.key);
    expect(keys.sort()).toEqual([
      "dfdValidation.assetLink.self_relation",
      "dfdValidation.assetLink.target_missing",
    ]);
  });

  it("assets without links and malformed entries are ignored", () => {
    expect(
      run([asset("d", "DA-1", "data", [{ relationType: "required_by" }]), { ...asset("f", "FU-1", "function"), assetRelations: undefined }]),
    ).toEqual([]);
  });

  it("is part of the DFD validation run (warnings, not errors)", () => {
    const v = new DFDValidator();
    const result = v.validate(
      [{ id: "p", type: "Process", name: "P", displayId: "P-1", position: { x: 0, y: 0 }, size: { width: 1, height: 1 }, properties: {} } as never],
      [],
      [asset("d", "HU-1", "human", [link("f", "required_by")]), asset("f", "FU-1", "function")],
      { totalElements: 1 } as never,
      { nodes: new Map(), edges: [] } as never,
    );
    expect(result.warnings.map((w) => w.key)).toContain("dfdValidation.assetLink.type_not_allowed");
    expect(result.errors.map((w) => w.key)).not.toContain("dfdValidation.assetLink.type_not_allowed");
  });
});
