// tests/unit/features/risks/services/concept-findings.test.ts
//
// ISO/SAE 21434 conformance plan Phase 4, P4-2 (decision 25): what goals and
// claims still lack — per risk by its own treatment, per goal / claim; only
// under ISO. Proposals for reduce risks without a goal.

import { describe, it, expect } from "vitest";
import { conceptFindings, conceptWarningsByRisk } from "features/risks/services/concept-findings";
import { openGoalProposals } from "features/risks/services/concept-proposals";
import type { Risk } from "features/risks/models/risk-assessment-types";
import { mergeClaims, mergeGoals, type CybersecurityConcept } from "shared";

// A selected mitigation by default — CONTROL_MISSING has its own test.
const risk = (id: string, treatment: string, extra: object = {}): Risk =>
  ({
    id,
    threatDisplayId: id,
    treatment,
    treatmentJustification: "",
    strideCategory: "T",
    linkedAssetIds: ["a1"],
    selectedMitigations: [{ id: "M-T-001", status: "open" }],
    ...extra,
  }) as unknown as Risk;

const concept = (c: Partial<CybersecurityConcept>): CybersecurityConcept => ({ goals: [], claims: [], verifications: [], ...c });
const codes = (f: ReturnType<typeof conceptFindings>) => f.map((x) => `${x.code}:${x.riskId ?? x.item}`);
const base = { isoMode: true, today: "2026-10-30" };

describe("concept findings", () => {
  it("per risk by its own treatment", () => {
    const f = conceptFindings({
      ...base,
      risks: [risk("R1", "reduce"), risk("R2", "accept"), risk("R3", "share"), risk("R4", "eliminate"), risk("R5", "eliminate", { treatmentJustification: "Port removed" })],
      concept: concept({}),
    });
    expect(codes(f)).toEqual(["GOAL_MISSING:R1", "CLAIM_MISSING:R2", "CLAIM_MISSING:R3", "AVOID_UNJUSTIFIED:R4"]);
  });

  it("reduce: no selected mitigation (rejected ones do not count), no residual rating", () => {
    const rated = { isoRisk: { impact: "severe", feasibility: "high", value: 5 } };
    const residual = { isoRisk: { ...rated.isoRisk, residual: { feasibility: "low", value: 3 } } };
    const goal = { id: "g1", displayId: "CSG-01", statement: "x", riskIds: ["R1", "R2", "R3", "R4"], assetProperties: [] };
    const f = conceptFindings({
      ...base,
      risks: [
        risk("R1", "reduce", { selectedMitigations: [], ...residual }),
        risk("R2", "reduce", { selectedMitigations: [{ id: "M-T-001", status: "rejected", rejectionReason: "n/a" }], ...residual }),
        risk("R3", "reduce", rated),
        risk("R4", "reduce", residual),
        // not rated yet: no residual finding (the risk itself is open)
        risk("R5", "reduce"),
        // other treatments need neither
        risk("R6", "accept", { selectedMitigations: [] , ...rated }),
      ],
      concept: concept({
        goals: [goal, { ...goal, id: "g2", displayId: "CSG-02", riskIds: ["R5"] }],
        claims: [{ id: "c1", displayId: "CLM-01", statement: "y", kind: "retain", riskIds: ["R6"], assumptionIds: ["as1"] }],
      }),
    });
    expect(codes(f)).toEqual(["CONTROL_MISSING:R1", "CONTROL_MISSING:R2", "RESIDUAL_MISSING:R3"]);
  });

  it("covered risks are fine; a link that no longer fits the treatment is flagged", () => {
    const f = conceptFindings({
      ...base,
      risks: [risk("R1", "reduce"), risk("R2", "accept")],
      concept: concept({
        goals: [{ id: "g1", displayId: "CSG-01", statement: "x", riskIds: ["R1", "R2"], assetProperties: [] }],
        claims: [{ id: "c1", displayId: "CLM-01", statement: "y", kind: "share", riskIds: ["R2"], assumptionIds: [], responsibleParty: "Installer" }],
      }),
    });
    expect(codes(f)).toEqual(["CLAIM_MISSING:R2", "TREATMENT_MISMATCH:R2", "TREATMENT_MISMATCH:R2"]);
  });

  it("per claim: no assumption, no party, invalid assumption, overdue; per item: empty, removed risk, unused", () => {
    const f = conceptFindings({
      ...base,
      risks: [risk("R1", "accept"), risk("R2", "share")],
      assumptions: [{ id: "as1", displayId: "ASM-01", text: "x", status: "invalid" }],
      concept: concept({
        goals: [{ id: "g1", displayId: "CSG-01", statement: "", riskIds: ["gone"], assetProperties: [] }],
        claims: [
          { id: "c1", displayId: "CLM-01", statement: "a", kind: "retain", riskIds: ["R1"], assumptionIds: [], reviewBy: "2026-10-01" },
          { id: "c2", displayId: "CLM-02", statement: "b", kind: "share", riskIds: ["R2"], assumptionIds: ["as1"] },
        ],
      }),
    });
    expect(codes(f)).toEqual([
      "EMPTY_STATEMENT:CSG-01",
      "REMOVED_RISK:CSG-01",
      "UNUSED:CSG-01",
      "NO_ASSUMPTION:CLM-01",
      "REVIEW_OVERDUE:CLM-01",
      "NO_PARTY:CLM-02",
      "INVALID_ASSUMPTION:CLM-02",
    ]);
    expect(f.find((x) => x.code === "UNUSED")!.severity).toBe("info");
  });

  it("other presets: no findings", () => {
    expect(conceptFindings({ ...base, isoMode: false, risks: [risk("R1", "reduce")], concept: undefined })).toEqual([]);
  });

  it("warnings per risk for the table marker", () => {
    const map = conceptWarningsByRisk(conceptFindings({ ...base, risks: [risk("R1", "reduce")], concept: undefined }));
    expect([...map.keys()]).toEqual(["R1"]);
  });
});

describe("goal proposals and merging", () => {
  const assets = {
    assets: [{ id: "a1", displayId: "DA-001", name: "Alarm", assetGroup: "data", securityGoals: [{ type: "I", level: "high", formalDescription: "Protect the alarm." }] }],
  } as never;

  it("one proposal per asset × property for the reduce risks still without a goal", () => {
    const p = openGoalProposals(
      [risk("R1", "reduce"), risk("R2", "reduce"), risk("R3", "accept"), risk("R4", "reduce")],
      concept({ goals: [{ id: "g", displayId: "CSG-01", statement: "x", riskIds: ["R4"], assetProperties: [] }] }),
      assets,
    );
    expect(p).toEqual([{ assetId: "a1", property: "I", label: "DA-001 Alarm × I", statement: "Protect the alarm.", riskIds: ["R1", "R2"] }]);
  });

  it("merge moves risks over and drops the source; claims only of the same kind", () => {
    const c = concept({
      goals: [
        { id: "g1", displayId: "CSG-01", statement: "a", riskIds: ["R1"], assetProperties: [{ assetId: "a1", property: "I" }] },
        { id: "g2", displayId: "CSG-02", statement: "b", riskIds: ["R2", "R1"], assetProperties: [] },
      ],
      claims: [
        { id: "c1", displayId: "CLM-01", statement: "a", kind: "retain", riskIds: ["R3"], assumptionIds: ["as1"] },
        { id: "c2", displayId: "CLM-02", statement: "b", kind: "share", riskIds: ["R4"], assumptionIds: [] },
      ],
    });
    const merged = mergeGoals(c, "g2", "g1");
    expect(merged.goals).toEqual([
      { id: "g1", displayId: "CSG-01", statement: "a", riskIds: ["R1", "R2"], assetProperties: [{ assetId: "a1", property: "I" }] },
    ]);
    expect(mergeClaims(c, "c2", "c1")).toBe(c);
  });
});
