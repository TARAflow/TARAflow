// src/tests/unit/app/utils/component-treatments.test.ts
//
// Multi-project TARA, phase 3a (design §7.4): how the component treated its
// risks, per instance, read-only — measures with their status (pending →
// CMP_MEASURE_PENDING), handed-over / accepted risks arrive untreated with
// the component's claims as the reason (CMP_HANDOVER_OPEN until the machine
// sets its own treatment; a justification alone does not decide).

import { describe, expect, it } from "vitest";
import type { Project } from "app/models/project-types";
import { componentFindings } from "app/services/component-import/component-findings";
import { componentTreatments, effectivenessOf, machineDecided, measureState, uncreditedResiduals } from "app/utils/component-treatments";
import { docResidualView } from "app/services/doc-residual";
import { buildThreatId } from "features/attacktree";
import { componentInstanceTfId } from "features/dfd";
import { withAssumptionStatus } from "app/services/component-import/assumption-status";
import { component, machine, snapshot, tid } from "../../../fixtures/component-treatment-machine";

describe("component treatments (phase 3a)", () => {
  const m = machine();
  const map = componentTreatments(m);

  it("reduce: the component's measures with their status; its own project mitigation named from the snapshot", () => {
    const tr = map.get(tid(component.reduceThreat))!;
    expect(tr).toMatchObject({ instanceLabel: "SD1 · Smoke Detector", treatment: "reduce", handedOver: false });
    expect(tr.measures.map((x) => [x.id, x.state])).toEqual([["M-S-001", "implemented"], ["M-C-001", "pending"]]);
    expect(tr.measures.find((x) => x.id === "M-C-001")!.text).toBe("Signed sensor frames");
  });

  it("phase 3c: the snapshot passes on only measures the component still has; a measure shows the assumptions it relies on", () => {
    expect(snapshot.assumptions[0].mitigationIds).toEqual(["M-C-001"]);
    const tr = map.get(tid(component.reduceThreat))!;
    expect(tr.measures.find((x) => x.id === "M-C-001")!.reliesOn).toEqual(["ASM-01"]);
    expect(tr.measures.find((x) => x.id === "M-S-001")!.reliesOn).toBeUndefined();
  });

  it("share: handed over, with the component's claim as the reason", () => {
    const tr = map.get(tid(component.shareThreat))!;
    expect(tr).toMatchObject({ treatment: "share", handedOver: true, justification: "The integrator controls the bus" });
    expect(tr.claims).toEqual([{ displayId: "CLM-01", kind: "share", statement: "The integrator isolates the sensor bus", responsibleParty: "Integrator" }]);
  });

  it("measure states: implemented / verified count, rejected apart, the rest pending", () => {
    expect(["implemented", "verified"].map(measureState)).toEqual(["implemented", "implemented"]);
    expect(measureState("rejected")).toBe("rejected");
    expect(["open", "in_progress", "in_review"].map(measureState)).toEqual(["pending", "pending", "pending"]);
  });

  it("decided: an own measure, or an own treatment other than reduce with a justification — not a justification alone", () => {
    expect(machineDecided({ treatment: "reduce", treatmentJustification: "", selectedMitigations: [] })).toBe(false);
    expect(machineDecided({ treatment: "reduce", treatmentJustification: "We think about it", selectedMitigations: [] })).toBe(false);
    expect(machineDecided({ treatment: "accept", treatmentJustification: "", selectedMitigations: [] })).toBe(false);
    expect(machineDecided({ treatment: "accept", treatmentJustification: "Bus inside the locked cabinet", selectedMitigations: [] })).toBe(true);
    expect(machineDecided({ treatment: "reduce", treatmentJustification: "", selectedMitigations: [{ id: "M-T-001", status: "open" }] as never })).toBe(true);
  });

  it("findings: CMP_MEASURE_PENDING and CMP_HANDOVER_OPEN per instance; the handover closes with the machine's treatment", () => {
    const keys = (p: Project) => componentFindings(p).warnings.map((w) => w.key.split(".").pop());
    expect(m.risks!.risks.some((r) => r.threatId === tid(component.reduceThreat))).toBe(true);
    expect(keys(m)).toContain("CMP_MEASURE_PENDING");
    expect(keys(m)).toContain("CMP_HANDOVER_OPEN");
    const decided = {
      ...m,
      risks: {
        ...m.risks!,
        risks: m.risks!.risks.map((r) => (r.threatId === tid(component.shareThreat) ? { ...r, treatment: "accept", treatmentJustification: "Bus inside the locked cabinet" } : r)),
      },
    } as Project;
    expect(keys(decided)).not.toContain("CMP_HANDOVER_OPEN");
  });
});

describe("effectiveness per instance (phase 3d-1, I7)", () => {
  const relies = [{ id: "a1", displayId: "ASM-01", status: "confirmed" }];
  it("implemented and every assumption fulfilled / not applicable → effective; none relied on → effective", () => {
    expect(effectivenessOf("implemented", relies, new Map([["a1", "fulfilled"]])).effectiveness).toBe("effective");
    expect(effectivenessOf("implemented", relies, new Map([["a1", "not_applicable"]])).effectiveness).toBe("effective");
    expect(effectivenessOf("implemented", [], new Map()).effectiveness).toBe("effective");
  });

  it("not fulfilled here, or invalid in the component → not effective; open or pending → unclear", () => {
    expect(effectivenessOf("implemented", relies, new Map([["a1", "not_fulfilled"]]))).toEqual({
      effectiveness: "not_effective",
      reasons: [{ kind: "aou_not_fulfilled", assumption: "ASM-01" }],
    });
    expect(effectivenessOf("implemented", [{ ...relies[0], status: "invalid" }], new Map([["a1", "fulfilled"]])).effectiveness).toBe("not_effective");
    expect(effectivenessOf("implemented", relies, new Map())).toEqual({ effectiveness: "unclear", reasons: [{ kind: "aou_open", assumption: "ASM-01" }] });
    expect(effectivenessOf("pending", [], new Map())).toEqual({ effectiveness: "unclear", reasons: [{ kind: "pending" }] });
    // not effective outweighs pending / open
    expect(effectivenessOf("pending", relies, new Map([["a1", "not_fulfilled"]])).effectiveness).toBe("not_effective");
  });

  it("in the read model: M-C-001 relies on ASM-01 — per instance status decides; findings name measure and assumption", () => {
    let m = machine();
    const measure = () => componentTreatments(m).get(tid(component.reduceThreat))!.measures.find((x) => x.id === "M-C-001")!;
    // pending (in_progress) and ASM-01 open
    expect(measure().effectiveness).toBe("unclear");
    m = { ...m, components: withAssumptionStatus(m.components!, "i1", "a1", { status: "not_fulfilled" }) } as Project;
    expect(measure()).toMatchObject({ effectiveness: "not_effective", reasons: [{ kind: "pending" }, { kind: "aou_not_fulfilled", assumption: "ASM-01" }] });
    const warnings = componentFindings(m).warnings;
    const notEffective = warnings.find((w) => w.key.endsWith("CMP_MEASURE_NOT_EFFECTIVE"))!;
    expect(notEffective.params).toMatchObject({ prefix: "SD1", list: "M-C-001 (ASM-01)" });
    // M-S-001 (implemented, relies on nothing) stays effective
    expect(componentTreatments(m).get(tid(component.reduceThreat))!.measures.find((x) => x.id === "M-S-001")!.effectiveness).toBe("effective");
  });
});

describe("credited residual (phase 3d-2a, I7 (4))", () => {
  const rated = (m: Project, treatment = "reduce"): Project => ({
    ...m,
    risks: {
      ...m.risks!,
      risks: m.risks!.risks.map((r) => ({ ...r, treatment, calculatedRiskBeforeMitigation: 9, calculatedRiskAfterMitigation: 2 })),
    },
  }) as Project;
  const reduceRisk = (m: Project) => m.risks!.risks.find((r) => r.threatId === tid(component.reduceThreat))!;

  it("a measure unclear / not effective here keeps the residual from counting; the blockers name measure, instance and causes", () => {
    let m = rated(machine());
    const unc = uncreditedResiduals(m);
    // M-C-001 is in progress and ASM-01 open → unclear; the share risk has no measure
    expect([...unc.keys()]).toEqual([reduceRisk(m).id]);
    expect(unc.get(reduceRisk(m).id)).toEqual([
      { measure: "M-C-001", context: "SD1 · Smoke Detector", state: "unclear", causes: [{ kind: "pending" }, { kind: "aou_open", ref: "ASM-01" }] },
    ]);
    m = { ...m, components: withAssumptionStatus(m.components!, "i1", "a1", { status: "not_fulfilled" }) } as Project;
    expect(uncreditedResiduals(m).get(reduceRisk(m).id)![0].state).toBe("not_effective");
  });

  it("every measure effective → the residual counts", () => {
    const m = rated(machine());
    const imp = m.components!.imports[0];
    const risks = imp.snapshot.risks.map((r) => ({ ...r, selectedMitigations: r.selectedMitigations.map((x) => ({ ...x, status: "implemented" })) }));
    const done = {
      ...m,
      components: withAssumptionStatus({ ...m.components!, imports: [{ ...imp, snapshot: { ...imp.snapshot, risks } }] } as never, "i1", "a1", { status: "fulfilled" }),
    } as Project;
    expect(uncreditedResiduals(done).size).toBe(0);
  });

  it("report data: the credited values replace the stored ones only there — the project keeps its after-values", () => {
    const m = rated(machine());
    const view = docResidualView(m);
    const r = view.risks!.risks.find((x) => x.id === reduceRisk(m).id)!;
    expect(r.calculatedRiskAfterMitigation).toBe(9);
    expect(r.mitigatedFactorRatings).toEqual(reduceRisk(m).factorRatings);
    expect(reduceRisk(m).calculatedRiskAfterMitigation).toBe(2);
    // a risk that counts stays the same object
    const other = m.risks!.risks.find((x) => x.id !== reduceRisk(m).id)!;
    expect(view.risks!.risks.find((x) => x.id === other.id)).toBe(other);
  });

  it("an accepted risk whose residual does not count → CMP_ACCEPTANCE_TO_REVIEW (derived)", () => {
    const keys = (p: Project) => componentFindings(p).warnings.map((w) => w.key.split(".").pop());
    expect(keys(rated(machine()))).not.toContain("CMP_ACCEPTANCE_TO_REVIEW");
    const accepted = rated(machine(), "accept");
    const w = componentFindings(accepted).warnings.find((x) => x.key.endsWith("CMP_ACCEPTANCE_TO_REVIEW"))!;
    expect(w.params).toMatchObject({ prefix: "SD1", list: reduceRisk(accepted).threatDisplayId });
  });

  it("ISO: a component risk on an attack-path threat applies to the instance's path risk (per attack path)", () => {
    const components = {
      imports: [
        {
          id: "imp",
          name: "C",
          snapshot: {
            risks: [{ id: "R-1", threatId: "AT-t1-pk1-T", treatment: "reduce", selectedMitigations: [{ id: "M-S-001", status: "in_progress" }] }],
            attackTrees: { trees: [{ id: "t1", pathAnalysis: { paths: [{ pathKey: "pk0" }, { pathKey: "pk1" }] } }] },
          },
        },
      ],
      instances: [{ id: "i1", importId: "imp", prefix: "C1" }],
    } as never;
    const pathThreat = buildThreatId(componentInstanceTfId("i1", "tree|t1"), "pk1", "T");
    expect(componentTreatments({ components }).get(pathThreat)?.componentRiskId).toBe("R-1");
    const risks = { risks: [{ id: "R-m", threatId: pathThreat }] } as never;
    expect(uncreditedResiduals({ components, risks }).get("R-m")?.[0]).toMatchObject({ measure: "M-S-001", state: "unclear" });
  });
});

describe("an assumption counts only once its evidence is implemented (2026-11-09)", () => {
  // M-C-001 implemented in the component, relying on ASM-01; the machine marks
  // ASM-01 fulfilled with its own measure M-T-001 as the evidence.
  const prepared = (machineStatus?: string): Project => {
    const m = machine();
    const imp = m.components!.imports[0];
    const risks = imp.snapshot.risks.map((r) => ({ ...r, selectedMitigations: r.selectedMitigations.map((x) => ({ ...x, status: "implemented" })) }));
    const components = withAssumptionStatus(
      { ...m.components!, imports: [{ ...imp, snapshot: { ...imp.snapshot, risks } }] } as never,
      "i1",
      "a1",
      { status: "fulfilled", evidence: { mitigationIds: ["M-T-001"] } },
    );
    const machineRisks = m.risks!.risks.map((r, i) =>
      i === 0 && machineStatus ? { ...r, selectedMitigations: [{ id: "M-T-001", status: machineStatus }] } : r,
    );
    return { ...m, components, risks: { ...m.risks!, risks: machineRisks } } as Project;
  };
  const measure = (p: Project) => componentTreatments(p).get(tid(component.reduceThreat))!.measures.find((x) => x.id === "M-C-001")!;

  it("evidence not implemented (ticket open) → unclear; the residual is not credited", () => {
    for (const p of [prepared(), prepared("in_progress")]) {
      expect(measure(p)).toMatchObject({
        effectiveness: "unclear",
        reasons: [{ kind: "aou_evidence_pending", assumption: "ASM-01", measures: ["M-T-001"] }],
      });
      const reduceRisk = p.risks!.risks.find((r) => r.threatId === tid(component.reduceThreat))!;
      expect(uncreditedResiduals(p).get(reduceRisk.id)?.[0].causes).toEqual([{ kind: "aou_evidence_pending", ref: "ASM-01 (M-T-001)" }]);
      const unclear = componentFindings(p).warnings.find((w) => w.key.endsWith("CMP_MEASURE_UNCLEAR"))!;
      expect(unclear.params).toMatchObject({ list: "M-C-001 (ASM-01)" });
    }
  });

  it("evidence implemented or verified (ticket closed, closed loop) → effective; the residual counts", () => {
    for (const status of ["implemented", "verified"]) {
      const p = prepared(status);
      expect(measure(p).effectiveness).toBe("effective");
      expect(uncreditedResiduals(p).size).toBe(0);
    }
  });

  it("without the machine's risks every evidence counts as not implemented", () => {
    const p = prepared("implemented");
    expect(componentTreatments({ components: p.components }).get(tid(component.reduceThreat))!.measures.find((x) => x.id === "M-C-001")!.effectiveness).toBe("unclear");
  });
});
