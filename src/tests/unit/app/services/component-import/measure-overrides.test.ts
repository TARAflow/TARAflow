// Multi-project TARA I7 (5), phase 3d-2b: the machine marks a component
// measure "not effective here" in one instance — rationale mandatory,
// downgrade only. It acts exactly like "not effective": the residual risk of
// every risk relying on it is not credited (3d-2a). Diff-detected with the
// instance (commit gate), copied with the decisions, findings for the mark
// and for a mark that acts on nothing.

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { unknownMeasureOverrides, withMeasureOverride } from "app/services/component-import/measure-overrides";
import { componentTreatments, uncreditedResiduals } from "app/utils/component-treatments";
import { componentFindings } from "app/services/component-import/component-findings";
import { copyInstanceRatings } from "app/services/component-import/copy-ratings";
import { DiffService } from "features/audit/services/diff-service";
import { component, machine, tid } from "../../../../fixtures/component-treatment-machine";

const mark = (m: Project, measureId: string, rationale: string | null, instanceId = "i1"): Project =>
  ({ ...m, components: withMeasureOverride(m.components!, instanceId, measureId, rationale, "2026-11-09") }) as Project;
const measureOf = (m: Project, id: string) => componentTreatments(m).get(tid(component.reduceThreat))!.measures.find((x) => x.id === id)!;
const reduceRisk = (m: Project) => m.risks!.risks.find((r) => r.threatId === tid(component.reduceThreat))!;

describe("measure override (phase 3d-2b)", () => {
  it("marks with a rationale and withdraws; no mark without a rationale", () => {
    const m = mark(machine(), "M-S-001", "  The controller strips the signature  ");
    expect(m.components!.instances[0].measureOverrides).toEqual([
      { measureId: "M-S-001", rationale: "The controller strips the signature", date: "2026-11-09" },
    ]);
    expect(mark(m, "M-S-001", null).components!.instances[0].measureOverrides).toBeUndefined();
    expect(() => mark(machine(), "M-S-001", " ")).toThrow(/rationale/);
  });

  it("an effective measure becomes not effective here, with the machine's rationale as the reason", () => {
    expect(measureOf(machine(), "M-S-001").effectiveness).toBe("effective");
    const m = mark(machine(), "M-S-001", "Signature stripped by the gateway");
    expect(measureOf(m, "M-S-001")).toMatchObject({
      effectiveness: "not_effective",
      reasons: [{ kind: "overridden_here", rationale: "Signature stripped by the gateway" }],
      override: { rationale: "Signature stripped by the gateway", date: "2026-11-09" },
    });
  });

  it("the residual risk is not credited; the cause carries the rationale", () => {
    const m = mark(machine(), "M-S-001", "Signature stripped by the gateway");
    const blockers = uncreditedResiduals(m).get(reduceRisk(m).id)!;
    expect(blockers.find((b) => b.measure === "M-S-001")).toEqual({
      measure: "M-S-001",
      context: "SD1 · Smoke Detector",
      state: "not_effective",
      causes: [{ kind: "overridden_here", ref: "Signature stripped by the gateway" }],
    });
  });

  it("findings: CMP_MEASURE_OVERRIDDEN names the measure (not CMP_MEASURE_NOT_EFFECTIVE); a mark on an unknown measure acts on nothing", () => {
    const m = mark(machine(), "M-S-001", "stripped");
    const warnings = componentFindings(m).warnings;
    expect(warnings.find((w) => w.key.endsWith("CMP_MEASURE_OVERRIDDEN"))!.params).toMatchObject({ prefix: "SD1", list: "M-S-001" });
    expect(warnings.some((w) => w.key.endsWith("CMP_MEASURE_NOT_EFFECTIVE"))).toBe(false);
    const orphan = mark(machine(), "M-X-999", "gone");
    expect(unknownMeasureOverrides(orphan.components!.instances[0], orphan.components!.imports[0])).toEqual(["M-X-999"]);
    expect(componentFindings(orphan).warnings.find((w) => w.key.endsWith("CMP_MEASURE_OVERRIDE_UNKNOWN"))!.params).toMatchObject({ list: "M-X-999" });
  });

  it("the audit diff sees the mark (commit gate)", () => {
    const m = machine();
    const strip = (p: Project) => ({ ...p, dfd: null, assets: null, threats: null, risks: null, attackTrees: null }) as never;
    const section = new DiffService().detectChanges(strip(mark(m, "M-S-001", "stripped")), strip(m)).find((c) => c.phase === "components")!;
    expect(section.changes[0].details!.map((d) => d.field)).toContain("measureOverrides");
  });

  it("copying ratings takes the marks as decisions; fill keeps the target's own", () => {
    const base = machine();
    const second = { ...base.components!.instances[0], id: "i2", prefix: "SD2", measureOverrides: [{ measureId: "M-S-001", rationale: "own", date: "d" }] };
    let m = { ...base, components: { ...base.components!, instances: [...base.components!.instances, second] } } as Project;
    m = mark(m, "M-S-001", "stripped");
    m = mark(m, "M-C-001", "no key store");
    const fill = copyInstanceRatings(m, "i1", "i2", { decisions: true, assetImpact: false, mode: "fill" });
    expect(fill.components.instances.find((i) => i.id === "i2")!.measureOverrides).toEqual([
      { measureId: "M-S-001", rationale: "own", date: "d" },
      { measureId: "M-C-001", rationale: "no key store", date: "2026-11-09" },
    ]);
    expect(fill.counts.measureOverrides).toBe(1);
    const over = copyInstanceRatings(m, "i1", "i2", { decisions: true, assetImpact: false, mode: "overwrite" });
    expect(over.components.instances.find((i) => i.id === "i2")!.measureOverrides!.find((o) => o.measureId === "M-S-001")!.rationale).toBe("stripped");
    expect(copyInstanceRatings(m, "i1", "i2", { decisions: false, assetImpact: false, mode: "fill" }).counts.measureOverrides).toBe(0);
  });
});
