// IEC-8b: the references a project mitigation can carry — the requirements
// of the active IEC 62443-4-2 editions, labelled with row and title; none
// without a 62443 edition; and a project mitigation's references count for
// the matrix like the catalog's (D-6).
import { describe, it, expect } from "vitest";
import { matrixRequirementOptions } from "app/utils/matrix-requirement-options";
import { activeStandards, mitigationRequirements } from "features/compliance";
import { addProjectMitigation } from "features/threats/services/project-mitigations";
import { DEFAULT_THREAT_CONFIGURATION } from "features/threats/models/threat-types";

describe("matrixRequirementOptions", () => {
  it("no 62443 edition (only EN 50742 A, or nothing) → no field", () => {
    expect(matrixRequirementOptions(activeStandards({ regulation: ["EN 50742 A"] }))).toBeUndefined();
    expect(matrixRequirementOptions([])).toBeUndefined();
  });

  it("every requirement once, labelled with the row and the title", () => {
    const matrix = matrixRequirementOptions(activeStandards({ regulation: ["IEC 62443", "EN IEC 62443 (CRA)"] }))!;
    const ids = matrix.options.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(matrix.options.find((o) => o.id === "cr-7.8")!.label).toMatch(/^CR 7\.8 — /);
    expect(ids).toContain("cr-4.1-rest"); // classic edition only
  });

  it("derived: what an effect meets already", () => {
    const matrix = matrixRequirementOptions(activeStandards({ regulation: ["EN IEC 62443 (CRA)"] }))!;
    expect(matrix.derivedFrom([{ targetType: "Process", property: "inputValidation", expectedValue: "strict" }])).toContain("cr-3.5");
  });
});

describe("project mitigation references (D-6)", () => {
  it("stored on add (no duplicates) and read by the matrix like a catalog entry", () => {
    const { configuration, id } = addProjectMitigation(DEFAULT_THREAT_CONFIGURATION, {
      text: "Asset register",
      strideCategory: "I",
      iec62443: ["cr-7.8", "cr-7.8"],
    });
    const entry = configuration.customMitigations!.find((m) => m.id === id)!;
    expect(entry.iec62443).toEqual(["cr-7.8"]);
    expect(mitigationRequirements(entry).map((r) => r.requirementId)).toEqual(["cr-7.8"]);
  });

  it("no references → no field stored", () => {
    const { configuration, id } = addProjectMitigation(DEFAULT_THREAT_CONFIGURATION, { text: "X", strideCategory: "S", iec62443: [] });
    expect("iec62443" in configuration.customMitigations!.find((m) => m.id === id)!).toBe(false);
  });
});
