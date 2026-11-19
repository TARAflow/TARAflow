// Duplicate id labels and imported component instances (manual test
// 2026-11-15): two instances of one component keep the component's boundary
// names ("Case [CASE]") — no finding among imported elements only; one of
// the machine's own elements with the same id still is one.
import { describe, expect, it } from "vitest";
import { validateDuplicateIdLabels } from "features/dfd/services/validators/element-validator";
import { isComponentInstanceTfId } from "features/dfd/services/leveled/component-tf-id";
import { componentInstanceTfId, instanceMultiprocessTfId } from "features/dfd";
import type { DFDElement, ValidationFinding } from "features/dfd/models/dfd-types";

const el = (id: string, displayId: string, name = `${displayId} name`) =>
  ({ id, displayId, name, type: "TrustBoundary", properties: {} }) as unknown as DFDElement;
const findings = (elements: DFDElement[]) => {
  const warnings: ValidationFinding[] = [];
  validateDuplicateIdLabels(elements, warnings);
  return warnings.map((w) => w.params?.id);
};
const sdc1 = (tf: string) => componentInstanceTfId("inst-1", tf);
const sdc2 = (tf: string) => componentInstanceTfId("inst-2", tf);

describe("isComponentInstanceTfId", () => {
  it("recognises the ids the import creates, not draw.io cell ids", () => {
    expect(isComponentInstanceTfId(sdc1("tb-case"))).toBe(true);
    expect(isComponentInstanceTfId(instanceMultiprocessTfId("inst-1"))).toBe(true);
    expect(isComponentInstanceTfId("kXy9AbCdEfGhIjKlMn-12")).toBe(false);
    expect(isComponentInstanceTfId("cmp-1")).toBe(false);
    expect(isComponentInstanceTfId(undefined)).toBe(false);
  });
});

describe("validateDuplicateIdLabels — imported instances", () => {
  it("the same boundary names in two instances of one component are no finding", () => {
    expect(findings([el(sdc1("case"), "CASE"), el(sdc2("case"), "CASE"), el(sdc1("sb"), "SB"), el(sdc2("sb"), "SB")])).toEqual([]);
  });

  it("a machine element with the id of an imported one is still a finding", () => {
    expect(findings([el(sdc1("case"), "CASE"), el("machine-cell-1", "CASE")])).toEqual(["CASE"]);
  });

  it("two of the machine's own elements with one id are still a finding", () => {
    expect(findings([el("a-1", "TB"), el("b-2", "TB")])).toEqual(["TB"]);
  });
});
