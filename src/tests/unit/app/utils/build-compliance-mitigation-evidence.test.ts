// Mitigation evidence for the IEC 62443-4-2 matrix
// (app/utils/build-compliance-mitigation-evidence.ts; D-6, D-16, D-21).
import { describe, it, expect } from "vitest";
import { buildComplianceMitigationEvidence } from "app/utils/build-compliance-mitigation-evidence";
import { evaluateMatrix, type Edition } from "features/compliance";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;

const catalog: Any[] = [
  { id: "M-D-002", iec62443: ["cr-7.2"], affectsProperties: [] },
  { id: "M-X", iec62443: ["cr-7.2", "no-such-id"], affectsProperties: [] },
  { id: "M-NONE", affectsProperties: [] },
];
const threats: Any = {
  perElementTables: [{ threats: [{ id: "t-a", linkedElement: { elementId: "proc-a", elementType: "Process" } }, { id: "t-b", linkedElement: { elementId: "proc-b", elementType: "Process" } }] }],
  perInteractionTables: [{ threats: [{ id: "t-f", dataFlow: { connectionId: "f1", sourceId: "ee", sourceType: "ExternalEntity", targetId: "proc-a", targetType: "Process" } }] }],
};
const risk = (threatId: string, mitigations: Any[], treatment = "reduce"): Any => ({ id: `R-${threatId}`, threatId, treatment, selectedMitigations: mitigations });

describe("buildComplianceMitigationEvidence", () => {
  it("one entry per chosen mitigation and risk, with the elements of its threat", () => {
    const out = buildComplianceMitigationEvidence(threats, { risks: [risk("t-a", [{ id: "M-D-002", status: "implemented" }]), risk("t-f", [{ id: "M-D-002", status: "open" }])] } as Any, catalog);
    expect(out).toEqual([
      { mitigationId: "M-D-002", requirementIds: ["cr-7.2"], done: true, concernsElementIds: ["proc-a"] },
      { mitigationId: "M-D-002", requirementIds: ["cr-7.2"], done: false, concernsElementIds: ["f1", "ee", "proc-a"] },
    ]);
  });

  it("skips accept / eliminate / transfer, rejected and unreferenced mitigations; drops unknown ids", () => {
    const out = buildComplianceMitigationEvidence(
      threats,
      {
        risks: [
          risk("t-a", [{ id: "M-D-002", status: "implemented" }], "accept"),
          risk("t-a", [{ id: "M-D-002", status: "rejected", rejectionReason: "x" }]),
          risk("t-a", [{ id: "M-NONE", status: "implemented" }, { notes: "custom text", status: "open" }]),
          risk("t-a", [{ id: "M-X", status: "verified" }]),
        ],
      } as Any,
      catalog,
    );
    expect(out).toEqual([{ mitigationId: "M-X", requirementIds: ["cr-7.2"], done: true, concernsElementIds: ["proc-a"] }]);
  });

  it("attack-path risks take the targets of their anchor (CL-3)", () => {
    const out = buildComplianceMitigationEvidence(threats, { risks: [risk("ap-1", [{ id: "M-D-002", status: "open" }])] } as Any, catalog, () => [
      { linkedElement: { elementId: "proc-b", elementType: "Process" }, dataFlow: null },
    ]);
    expect(out[0].concernsElementIds).toEqual(["proc-b"]);
  });

  it("done for another component's risk, open for this one: not met in the achieved run (D-16)", () => {
    const evidence = buildComplianceMitigationEvidence(
      threats,
      { risks: [risk("t-b", [{ id: "M-D-002", status: "implemented" }]), risk("t-a", [{ id: "M-D-002", status: "open" }])] } as Any,
      catalog,
    );
    const edition: Edition = {
      id: "en-iec-62443-4-2-praa-2026",
      title: "t",
      draft: true,
      ccsc2Label: "supporting measures",
      rows: [{ label: "CR 7.2", fr: "RA", minSl: 1, requirementIds: ["cr-7.2"], supportingMeasuresAllowed: false }],
    };
    const view = { elements: [{ id: "proc-a", type: "Process" }, { id: "proc-b", type: "Process" }], flows: [] };
    const run = (r: "achieved" | "planned") =>
      evaluateMatrix({ edition, view, scope: new Set(["proc-a"]), run: r, mitigations: evidence }).rows[0];
    expect(run("achieved").status).toBe("needs-statement");
    expect(run("planned").status).toBe("met");
  });
});
