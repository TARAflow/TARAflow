// Multi-project TARA I7 (4), phase 3d-2a: the residual risk a reader may
// count — the values before treatment while a measure does not hold; the
// stored after-values are never changed.

import { describe, expect, it } from "vitest";
import { acceptanceToReview, blockerLines, creditedResidual, withCreditedResidual, type ResidualBlocker } from "shared";

const before = [{ factorId: "f", value: 3 }];
const after = [{ factorId: "f", value: 1 }];
const risk = {
  id: "R-1",
  treatment: "reduce",
  calculatedRiskBeforeMitigation: 9,
  calculatedRiskAfterMitigation: 3,
  factorRatings: before,
  mitigatedFactorRatings: after,
  isoRisk: { impact: "major", feasibility: "high", value: 4, residual: { feasibility: "low", value: 2 } },
};
const blocker: ResidualBlocker = {
  measure: "M-C-012",
  context: "SD2 · Smoke Detector",
  state: "not_effective",
  causes: [{ kind: "aou_not_fulfilled", ref: "ASM-03" }],
};
const unc = new Map([["R-1", [blocker]]]);

describe("creditedResidual", () => {
  it("counts the stored after-values when nothing blocks", () => {
    expect(creditedResidual(risk, undefined)).toEqual({
      credited: true,
      blockers: [],
      riskAfter: 3,
      mitigatedFactorRatings: after,
      isoResidual: { feasibility: "low", value: 2 },
    });
    expect(creditedResidual(risk, new Map([["R-2", [blocker]]])).credited).toBe(true);
  });

  it("not credited: the values before treatment count — generic and ISO", () => {
    expect(creditedResidual(risk, unc)).toEqual({
      credited: false,
      blockers: [blocker],
      riskAfter: 9,
      mitigatedFactorRatings: before,
      isoResidual: { feasibility: "high", value: 4 },
    });
  });

  it("ISO without a residual rating stays without one", () => {
    const { residual: _r, ...iso } = risk.isoRisk;
    expect(creditedResidual({ ...risk, isoRisk: iso }, unc).isoResidual).toBeUndefined();
  });

  it("withCreditedResidual: a copy with the credited values; the risk itself unchanged, the same object when it counts", () => {
    const copy = withCreditedResidual(risk, unc);
    expect(copy).toMatchObject({ id: "R-1", calculatedRiskAfterMitigation: 9, mitigatedFactorRatings: before, isoRisk: { value: 4, residual: { value: 4 } } });
    expect(risk.calculatedRiskAfterMitigation).toBe(3);
    expect(withCreditedResidual(risk, new Map())).toBe(risk);
  });

  it("acceptance to review: accepted and not credited", () => {
    expect(acceptanceToReview({ ...risk, treatment: "accept" }, unc)).toBe(true);
    expect(acceptanceToReview(risk, unc)).toBe(false);
    expect(acceptanceToReview({ ...risk, treatment: "accept" }, new Map())).toBe(false);
  });

  it("blockerLines: measure, context and causes in the caller's words", () => {
    expect(blockerLines([blocker], (c) => `${c.ref} not fulfilled`)).toEqual(["M-C-012 (SD2 · Smoke Detector): ASM-03 not fulfilled"]);
    expect(blockerLines([{ ...blocker, causes: [] }], () => "")).toEqual(["M-C-012 (SD2 · Smoke Detector)"]);
  });
});
