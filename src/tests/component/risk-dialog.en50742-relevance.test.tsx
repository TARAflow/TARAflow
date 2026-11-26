// EN 50742 O18 (user 2026-11-20): in an EN 50742 A project a risk whose
// threat is not on a relevant interface / flow (outside the safety zone,
// off the path to a safety function) shows why, and has no SRSL section —
// a manual EL from before does not bring it back.
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskDialog } from "features/risks/components/risk-dialog";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { Risk } from "features/risks/models/risk-assessment-types";
import type { ThreatReference } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));
Element.prototype.scrollIntoView = () => {};
afterEach(cleanup);

const configuration = { ...DEFAULT_CONFIGURATION, likelihoodMethod: "en-50742-a" as const, windowOfOpportunity: "moderately_restricted" as const };
const risk = {
  id: "r1", threatId: "t1", threatDisplayId: "IF-2-T-1", sourceStrideMethod: "per-element", threatDescription: "Tamper", strideCategory: "T",
  threatRelevance: "relevant", linkedAssetIds: [], treatment: "reduce", moscowPriority: "must", selectedMitigations: [], selectedVerifications: [],
  proposedMitigations: [], proposedVerifications: [],
  // a manual EL from before the safety zone was drawn
  factorRatings: [{ factorId: "exposure_level", value: 4, weight: 1, source: "manual" }, { factorId: "attacker_capability", value: 3, weight: 1 }],
  mitigatedFactorRatings: [], calculatedRiskBeforeMitigation: 0, calculatedRiskAfterMitigation: 0,
} as unknown as Risk;
const threat = (en50742?: ThreatReference["en50742"]) =>
  ({
    id: "t1", displayId: "IF-2-T-1", strideCategory: "T", threatDescription: "Tamper", attackDescription: "", sourceStrideMethod: "per-element",
    relevance: "relevant", proposedMitigations: [], proposedVerifications: [], trustBoundaryId: null, trustBoundaryName: null,
    linkedElement: { elementId: "if-2", elementType: "Interface", elementName: "Service port", displayId: "IF-2" },
    ...(en50742 ? { en50742 } : {}),
  }) as unknown as ThreatReference;

const open = (t: ThreatReference) =>
  render(<RiskDialog open risks={[risk]} initialIndex={0} configuration={configuration} threats={[t]} onSave={() => {}} onClose={() => {}} />);

describe("RiskDialog — EN 50742 relevance (O18)", () => {
  it("not relevant: the reason is shown, the SRSL section is not", () => {
    open(threat({ relevant: false, reason: "the interface / flow does not cross the safety zone" }));
    expect(screen.getByTestId("en50742-not-relevant").textContent).toContain("Not EN 50742 relevant — the interface / flow does not cross the safety zone");
    expect(screen.queryByText(/Window of Opportunity/)).toBeNull();
  });

  it("relevant: no hint, the SRSL section is there", () => {
    open(threat({ relevant: true, reason: "the flow crosses the safety zone SZ" }));
    expect(screen.queryByTestId("en50742-not-relevant")).toBeNull();
    expect(screen.getAllByText(/Window of Opportunity/).length).toBeGreaterThan(0);
  });
});
