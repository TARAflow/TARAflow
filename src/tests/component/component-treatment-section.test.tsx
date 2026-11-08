// src/tests/component/component-treatment-section.test.tsx
// Multi-project TARA, phase 3a (design §7.4): the component's treatment of
// an imported risk in the risk dialog — read-only measures with status, or
// the handover with the component's claims; and the dialog's generic slot.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComponentTreatmentSection } from "features/components";
import { RiskDialog } from "features/risks/components/risk-dialog";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { Risk } from "features/risks/models/risk-assessment-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));
Element.prototype.scrollIntoView = () => {};
afterEach(cleanup);

describe("ComponentTreatmentSection", () => {
  it("reduce: measures with their status; pending ones depend on a component release", () => {
    render(
      <ComponentTreatmentSection
        view={{
          instanceLabel: "SD1 · Smoke Detector",
          treatment: "reduce",
          measures: [
            { id: "M-S-001", text: "Authenticate the bus", status: "implemented", state: "implemented" },
            { id: "M-C-001", text: "Signed sensor frames", status: "in_progress", state: "pending", reliesOn: ["ASM-01"] },
          ],
          claims: [],
          handedOver: false,
        }}
      />,
    );
    expect(screen.getByTestId("component-treatment").textContent).toContain("Treatment in the component (SD1 · Smoke Detector): reduce");
    expect(screen.getByTestId("component-treatment-measure-M-C-001").textContent).toContain("Signed sensor frames");
    expect(screen.getByTestId("component-treatment-pending")).toBeTruthy();
    expect(screen.getByTestId("component-treatment-relies-M-C-001").textContent).toBe("relies on ASM-01");
  });

  it("handed over: open until the machine decides, with the component's claims", () => {
    const view = {
      instanceLabel: "SD1 · Smoke Detector",
      treatment: "share",
      justification: "The integrator controls the bus",
      measures: [],
      claims: [{ displayId: "CLM-01", kind: "share", statement: "The integrator isolates the sensor bus", responsibleParty: "Integrator" }],
      handedOver: true,
    };
    const { rerender } = render(<ComponentTreatmentSection view={{ ...view, decided: false }} />);
    expect(screen.getByTestId("component-treatment-handover").textContent).toContain("arrives untreated");
    expect(screen.getByTestId("component-treatment-claim-CLM-01").textContent).toContain("Integrator");
    rerender(<ComponentTreatmentSection view={{ ...view, decided: true }} />);
    expect(screen.getByTestId("component-treatment-handover").textContent).toContain("has set its own treatment");
  });
});

describe("RiskDialog — extra section slot", () => {
  it("renders the app's section above the risk's mitigations", () => {
    const risk = {
      id: "r1", threatId: "t1", threatDisplayId: "SD1:P3-T-1", sourceStrideMethod: "per-element", threatDescription: "Tamper", strideCategory: "T",
      threatRelevance: "relevant", linkedAssetIds: [], treatment: "reduce", moscowPriority: "must", selectedMitigations: [], selectedVerifications: [],
      proposedMitigations: [], proposedVerifications: [], factorRatings: [], mitigatedFactorRatings: [], calculatedRiskBeforeMitigation: 0, calculatedRiskAfterMitigation: 0,
    } as unknown as Risk;
    const slot = vi.fn((r: Risk) => <div data-testid="slot">{r.threatDisplayId}</div>);
    render(<RiskDialog open risks={[risk]} initialIndex={0} configuration={DEFAULT_CONFIGURATION} onSave={() => {}} onClose={() => {}} extraSection={slot} />);
    fireEvent.click(screen.getAllByRole("tab")[1]);
    expect(screen.getByTestId("slot").textContent).toBe("SD1:P3-T-1");
  });
});

describe("RiskDialog — a measure shows the assumptions it relies on (phase 3c)", () => {
  it("relies on ASM-01 at the measure", () => {
    const risk = {
      id: "r1", threatId: "t1", threatDisplayId: "P3-T-1", sourceStrideMethod: "per-element", threatDescription: "Tamper", strideCategory: "T",
      threatRelevance: "relevant", linkedAssetIds: [], treatment: "reduce", moscowPriority: "must", selectedMitigations: [], selectedVerifications: [],
      proposedMitigations: [{ id: "M-T-001" }], proposedVerifications: [], factorRatings: [], mitigatedFactorRatings: [], calculatedRiskBeforeMitigation: 0, calculatedRiskAfterMitigation: 0,
    } as unknown as Risk;
    render(
      <RiskDialog
        open
        risks={[risk]}
        initialIndex={0}
        configuration={DEFAULT_CONFIGURATION}
        onSave={() => {}}
        onClose={() => {}}
        assumptions={[{ id: "a1", displayId: "ASM-01", text: "Cabinet locked", status: "confirmed", mitigationIds: ["M-T-001"] }]}
      />,
    );
    fireEvent.click(screen.getAllByRole("tab")[1]);
    expect(screen.getByTestId("mitigation-relies-on-M-T-001").textContent).toBe("relies on ASM-01");
  });
});
