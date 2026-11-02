// Pure updates of the stored matrix data (shared/models/compliance-data-types.ts,
// iec-62443-4-2-cra-coverage.md D-8, K-C1, D-31; one block per family since
// schema 13, model-coverage-implementation-plan.md §2.4, K-2, K-5).
import { describe, it, expect } from "vitest";
import {
  complianceComponentOf,
  familyCompliance,
  withComplianceComponent,
  withComplianceStatement,
  withComplianceTarget,
  withDeviceCategories,
  withoutComplianceStatement,
  requirementKey,
  type ComplianceData,
  type ComplianceStatement,
} from "shared";
const st = (reasoning: string): ComplianceStatement => ({ status: "met", reasoning, date: "2026-11-02" });
const F = "iec-62443-4-2" as const;

describe("compliance data helpers", () => {
  it("statements are kept per requirement in the family block — one statement, whatever edition shows the row (D-31)", () => {
    let data = withComplianceStatement(undefined, F, "cr-1.7", st("a"));
    data = withComplianceStatement(data, F, "cr-2.9", st("b"));
    expect(familyCompliance(data, F).statements?.["cr-1.7"].reasoning).toBe("a");
    data = withComplianceStatement(data, F, "cr-1.7", st("c"));
    expect(familyCompliance(data, F).statements?.["cr-1.7"].reasoning).toBe("c");
    data = withoutComplianceStatement(data, F, "cr-1.7");
    expect(data).toEqual({ families: { [F]: { statements: { "cr-2.9": st("b") } } } });
  });

  it("the key of a row: its requirement ids, sorted and joined", () => {
    expect(requirementKey(["cr-4.1-transit", "cr-4.1-rest"])).toBe("cr-4.1-rest+cr-4.1-transit");
    expect(requirementKey(["cr-3.10"])).toBe("cr-3.10");
  });

  it("a target per group can be set and cleared", () => {
    let data = withComplianceTarget(undefined, F, "IAC", 3);
    data = withComplianceTarget(data, F, "UC", 2);
    expect(familyCompliance(data, F).target).toEqual({ IAC: 3, UC: 2 });
    expect(familyCompliance(withComplianceTarget(data, F, "IAC", undefined), F).target).toEqual({ UC: 2 });
  });

  it("changing the device category never deletes statements (K-C1)", () => {
    let data = withComplianceStatement(undefined, F, "cr-3.10", st("as a gateway"));
    data = withDeviceCategories(data, F, { categories: ["NDR"], source: "manual" });
    data = withDeviceCategories(data, F, { categories: ["EDR"], source: "manual" });
    expect(familyCompliance(data, F).deviceCategories).toEqual({ categories: ["EDR"], source: "manual" });
    expect(familyCompliance(data, F).statements?.["cr-3.10"]).toBeDefined();
    expect(familyCompliance(withDeviceCategories(data, F, undefined), F).deviceCategories).toBeUndefined();
  });

  it("the component can be chosen and reset to the whole model (D-7)", () => {
    const data = withComplianceComponent(undefined, "mp_ctl");
    expect(data.componentId).toBe("mp_ctl");
    expect("componentId" in withComplianceComponent(data, undefined)).toBe(false);
  });

  it("a family's own component overrides the default (K-5)", () => {
    expect(complianceComponentOf({ componentId: "mp_ctl" }, F)).toBe("mp_ctl");
    const own: ComplianceData = { componentId: "mp_ctl", families: { [F]: { componentId: "p_fw" } } };
    expect(complianceComponentOf(own, F)).toBe("p_fw");
    expect(complianceComponentOf(undefined, F)).toBeUndefined();
  });

  it("a family without data reads as empty, and updates keep the other fields", () => {
    expect(familyCompliance(undefined, F)).toEqual({});
    const data = withComplianceTarget({ componentId: "mp_ctl" }, F, "SI", 2);
    expect(data).toEqual({ componentId: "mp_ctl", families: { [F]: { target: { SI: 2 } } } });
  });
});
