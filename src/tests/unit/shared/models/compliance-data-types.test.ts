// Pure updates of the stored matrix data (shared/models/compliance-data-types.ts,
// iec-62443-4-2-cra-coverage.md D-8, K-C1).
import { describe, it, expect } from "vitest";
import {
  withComplianceComponent,
  withComplianceStatement,
  withComplianceTarget,
  withDeviceCategories,
  withoutComplianceStatement,
  type ComplianceStatement,
} from "shared";

const PRAA = "en-iec-62443-4-2-praa-2026" as const;
const CLASSIC = "iec-62443-4-2-2019" as const;
const st = (reasoning: string): ComplianceStatement => ({ status: "met", reasoning, date: "2026-11-02" });

describe("compliance data helpers", () => {
  it("statements are kept per edition — switching the tags loses neither set", () => {
    let data = withComplianceStatement(undefined, PRAA, "CR 1.7", st("a"));
    data = withComplianceStatement(data, CLASSIC, "CR 1.7", st("b"));
    expect(data.statements?.[PRAA]?.["CR 1.7"].reasoning).toBe("a");
    expect(data.statements?.[CLASSIC]?.["CR 1.7"].reasoning).toBe("b");
    data = withoutComplianceStatement(data, PRAA, "CR 1.7");
    expect(data.statements?.[PRAA]).toEqual({});
    expect(data.statements?.[CLASSIC]?.["CR 1.7"]).toBeDefined();
  });

  it("a target per FR can be set and cleared", () => {
    let data = withComplianceTarget(undefined, "IAC", 3);
    data = withComplianceTarget(data, "UC", 2);
    expect(data.target).toEqual({ IAC: 3, UC: 2 });
    expect(withComplianceTarget(data, "IAC", undefined).target).toEqual({ UC: 2 });
  });

  it("changing the device category never deletes statements (K-C1)", () => {
    let data = withComplianceStatement(undefined, CLASSIC, "NDR 3.10", st("as a gateway"));
    data = withDeviceCategories(data, { categories: ["NDR"], source: "manual" });
    data = withDeviceCategories(data, { categories: ["EDR"], source: "manual" });
    expect(data.deviceCategories).toEqual({ categories: ["EDR"], source: "manual" });
    expect(data.statements?.[CLASSIC]?.["NDR 3.10"]).toBeDefined();
    expect(withDeviceCategories(data, undefined).deviceCategories).toBeUndefined();
  });

  it("the component can be chosen and reset to the whole model (D-7)", () => {
    const data = withComplianceComponent(undefined, "mp_ctl");
    expect(data.componentId).toBe("mp_ctl");
    expect("componentId" in withComplianceComponent(data, undefined)).toBe(false);
  });
});
