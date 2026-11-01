// Pure updates of the stored matrix data (shared/models/compliance-data-types.ts,
// iec-62443-4-2-cra-coverage.md D-8, K-C1, D-31).
import { describe, it, expect } from "vitest";
import {
  withComplianceComponent,
  withComplianceStatement,
  withComplianceTarget,
  withDeviceCategories,
  withoutComplianceStatement,
  requirementKey,
  type ComplianceStatement,
} from "shared";
const st = (reasoning: string): ComplianceStatement => ({ status: "met", reasoning, date: "2026-11-02" });

describe("compliance data helpers", () => {
  it("statements are kept per requirement — one statement, whatever edition shows the row (D-31)", () => {
    let data = withComplianceStatement(undefined, "cr-1.7", st("a"));
    data = withComplianceStatement(data, "cr-2.9", st("b"));
    expect(data.statements?.["cr-1.7"].reasoning).toBe("a");
    data = withComplianceStatement(data, "cr-1.7", st("c"));
    expect(data.statements?.["cr-1.7"].reasoning).toBe("c");
    data = withoutComplianceStatement(data, "cr-1.7");
    expect(data.statements).toEqual({ "cr-2.9": st("b") });
  });

  it("the key of a row: its requirement ids, sorted and joined", () => {
    expect(requirementKey(["cr-4.1-transit", "cr-4.1-rest"])).toBe("cr-4.1-rest+cr-4.1-transit");
    expect(requirementKey(["cr-3.10"])).toBe("cr-3.10");
  });

  it("a target per FR can be set and cleared", () => {
    let data = withComplianceTarget(undefined, "IAC", 3);
    data = withComplianceTarget(data, "UC", 2);
    expect(data.target).toEqual({ IAC: 3, UC: 2 });
    expect(withComplianceTarget(data, "IAC", undefined).target).toEqual({ UC: 2 });
  });

  it("changing the device category never deletes statements (K-C1)", () => {
    let data = withComplianceStatement(undefined, "cr-3.10", st("as a gateway"));
    data = withDeviceCategories(data, { categories: ["NDR"], source: "manual" });
    data = withDeviceCategories(data, { categories: ["EDR"], source: "manual" });
    expect(data.deviceCategories).toEqual({ categories: ["EDR"], source: "manual" });
    expect(data.statements?.["cr-3.10"]).toBeDefined();
    expect(withDeviceCategories(data, undefined).deviceCategories).toBeUndefined();
  });

  it("the component can be chosen and reset to the whole model (D-7)", () => {
    const data = withComplianceComponent(undefined, "mp_ctl");
    expect(data.componentId).toBe("mp_ctl");
    expect("componentId" in withComplianceComponent(data, undefined)).toBe(false);
  });
});
