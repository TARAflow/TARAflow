// src/tests/component/risk-dialog.component-factor.test.tsx
// Multi-project TARA, patch 16 (design §7.2): a factor value taken over
// from an imported component shows its origin; overriding it asks for a
// rationale, which is saved with the rating.
import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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

const rating = (factorId: string, value: number, extra: Record<string, unknown> = {}) => ({ factorId, value, weight: 1, ...extra });
const risk = (skill: Record<string, unknown>) =>
  ({
    id: "r1", threatId: "t1", threatDisplayId: "SD1:P3-T-1", sourceStrideMethod: "per-element", threatDescription: "Tamper", strideCategory: "T",
    threatRelevance: "relevant", linkedAssetIds: [], treatment: "reduce", moscowPriority: "must", selectedMitigations: [], selectedVerifications: [],
    proposedMitigations: [], proposedVerifications: [],
    factorRatings: [skill, rating("motive", 2), rating("opportunity", 2), rating("ease_of_exploit", 2), rating("deployment_scope", 1)],
    mitigatedFactorRatings: [], calculatedRiskBeforeMitigation: 0, calculatedRiskAfterMitigation: 0,
  }) as unknown as Risk;

function open(r: Risk) {
  const onSave = vi.fn();
  render(<RiskDialog open risks={[r]} initialIndex={0} configuration={DEFAULT_CONFIGURATION} onSave={onSave} onClose={() => {}} />);
  return onSave;
}

describe("RiskDialog — factor taken over from a component", () => {
  it("shows its origin", () => {
    open(risk(rating("skill_level", 3, { source: "derived", derivedValue: 3, derivedFrom: "component" })));
    expect(within(screen.getByRole("dialog")).getByText("Component")).toBeTruthy();
    expect(screen.queryByTestId("factor-override-rationale-skill_level")).toBeNull();
  });

  it("an override asks for a rationale, saved with the rating", async () => {
    const onSave = open(risk(rating("skill_level", 1, { source: "manual", derivedValue: 3, derivedFrom: "component" })));
    const input = screen.getByTestId("factor-override-rationale-skill_level");
    await act(async () => {
      fireEvent.change(input, { target: { value: "Attack needs physical access in this machine" } });
    });
    const last = onSave.mock.calls[onSave.mock.calls.length - 1][1];
    expect(last.factorRatings.find((f: { factorId: string }) => f.factorId === "skill_level")).toMatchObject({
      value: 1,
      source: "manual",
      overrideRationale: "Attack needs physical access in this machine",
    });
  });

  it("an Asset-derived override asks for nothing", () => {
    open(risk(rating("skill_level", 1, { source: "manual", derivedValue: 3 })));
    expect(screen.queryByTestId("factor-override-rationale-skill_level")).toBeNull();
  });
});
