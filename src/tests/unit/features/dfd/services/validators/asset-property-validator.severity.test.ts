// Model field purpose design §7 (review 2026-11-14): a missing asset group
// property (data type, lifecycle, exposure, role, …) is an INFO — no
// calculation reads these fields yet, so they neither warn nor keep the DFD
// phase from "complete". A missing name stays a warning.
import { describe, expect, it } from "vitest";
import { validateAssetProperties } from "features/dfd/services/validators/asset-property-validator";
import type { ValidationFinding } from "features/dfd/models/dfd-types";

const asset = (assetGroup: string, name = "A") => ({ id: `a-${assetGroup}`, displayId: "X-001", name, assetGroup, linkedElements: [] }) as never;

describe("asset property findings: severity", () => {
  it("missing group properties are infos, not warnings", () => {
    const warnings: ValidationFinding[] = [];
    const infos: ValidationFinding[] = [];
    validateAssetProperties(["data", "system", "infrastructure", "service", "human", "process"].map((g) => asset(g)), warnings, infos);
    expect(warnings).toEqual([]);
    expect(infos.map((f) => f.key).sort()).toEqual(
      [
        "dfdValidation.assetMissingAutomationLevel",
        "dfdValidation.assetMissingDataType",
        "dfdValidation.assetMissingExposure",
        "dfdValidation.assetMissingLifecycle",
        "dfdValidation.assetMissingPhysicalAccess",
        "dfdValidation.assetMissingResponsibility",
        "dfdValidation.assetMissingRole",
        "dfdValidation.assetMissingServiceType",
      ].sort(),
    );
  });

  it("a missing name stays a warning", () => {
    const warnings: ValidationFinding[] = [];
    const infos: ValidationFinding[] = [];
    validateAssetProperties([asset("function", "")], warnings, infos);
    expect(warnings.map((f) => f.key)).toEqual(["dfdValidation.assetMissingName"]);
    expect(infos).toEqual([]);
  });
});
