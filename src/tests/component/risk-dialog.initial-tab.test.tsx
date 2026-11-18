// src/tests/component/risk-dialog.initial-tab.test.tsx
//
// Manual test 2026-11-18: a click on "marked not effective here" in the Risks
// tab's findings opened the risk dialog on "Risk Before" — the mark is set
// and withdrawn on "Mitigations". A finding opens the dialog on the tab where
// it is fixed, and browsing its risks stays there.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskDialog } from "features/risks/components/risk-dialog";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { Risk } from "features/risks/models/risk-assessment-types";
import { RISK_FINDING_TAB } from "features/risks/services/risk-findings";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

Element.prototype.scrollIntoView = () => {};
afterEach(cleanup);

const risk = (id: string, displayId: string): Risk =>
  ({
    id,
    threatId: `t-${id}`,
    threatDisplayId: displayId,
    sourceStrideMethod: "per-element",
    threatDescription: "Spoof",
    strideCategory: "S",
    linkedAssetIds: [],
    treatment: "reduce",
    moscowPriority: "must",
    selectedMitigations: [],
    selectedVerifications: [],
    factorRatings: [],
    mitigatedFactorRatings: [],
    calculatedRiskBeforeMitigation: 4,
    calculatedRiskAfterMitigation: 0,
    wontJustification: "",
  }) as unknown as Risk;

const selectedTab = () => screen.getAllByRole("tab").find((t) => t.getAttribute("aria-selected") === "true")?.textContent;

describe("risk dialog — the tab a finding opens", () => {
  it("without a tab: Risk Before, as before", () => {
    render(<RiskDialog open risks={[risk("r1", "P1-S-1")]} initialIndex={0} configuration={DEFAULT_CONFIGURATION} onSave={() => {}} onClose={() => {}} />);
    expect(selectedTab()).toBe("Risk Before");
  });

  it("opened on Mitigations; the next risk of the finding stays there", () => {
    render(
      <RiskDialog
        open
        risks={[risk("r1", "P1-S-1"), risk("r2", "P1-S-2")]}
        initialIndex={0}
        initialTab="mitigations"
        configuration={DEFAULT_CONFIGURATION}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(selectedTab()).toBe("Mitigations");
    fireEvent.click(screen.getByText("P1-S-2"));
    expect(selectedTab()).toBe("Mitigations");
  });

  it("each finding names its tab: rating before, treatment and mitigations, residual after", () => {
    expect(RISK_FINDING_TAB).toMatchObject({ unrated: "before", reduceUnmitigated: "mitigations", treatmentNoJustification: "mitigations", residualMissing: "after" });
  });
});
