// src/tests/component/risk-config-dialog.reset-cancel.test.tsx
//
// Reported by the analyst: "reset to default" on the impact factors switched
// every impact factor off; after Cancel and reopening they were still off.
//
// Two bugs:
//  1. The dialog stayed mounted with its local copy — Cancel did not discard,
//     the cancelled edit came back on the next opening.
//  2. "Reset" for impact restored the ship default (all impact factors off)
//     although the project's impact set is the criteria configured in the
//     Asset Tab (updateImpactFactorsAutoEnable).

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RiskConfigDialog } from "features/risks/components/risk-config-dialog";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskConfiguration } from "features/risks/models/risk-config-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
      const base = options?.defaultValue ?? key;
      return base.replace(/\{\{(\w+)\}\}/g, (_m, n: string) =>
        options && n in options ? String(options[n]) : `{{${n}}}`,
      );
    },
    i18n: { language: "en" },
  }),
}));

// The project configured financial damage and operational in the Asset Tab;
// the risk sync enabled them (autoEnabled).
const configuration: RiskConfiguration = {
  ...DEFAULT_CONFIGURATION,
  activeFactors: DEFAULT_CONFIGURATION.activeFactors.map((f) =>
    ["financial_damage", "operational"].includes(f.factorId)
      ? { ...f, enabled: true, autoEnabled: true }
      : f,
  ),
};
const CONFIGURED = ["financial_damage", "operational"];

const checkbox = (id: string) => screen.getByTestId(`factor-check-${id}`) as HTMLInputElement;

function renderDialog(open: boolean, onSave = vi.fn(), weights?: Record<string, number>) {
  return (
    <RiskConfigDialog
      open={open}
      configuration={
        weights ? { ...configuration, impactWeightSource: "asset" } : configuration
      }
      onSave={onSave}
      onClose={() => {}}
      configuredImpactCriteria={CONFIGURED}
      assetImpactWeights={weights}
    />
  );
}

describe("RiskConfigDialog — reset and cancel", () => {
  it("Cancel discards: a cancelled edit is gone on the next opening", () => {
    const { rerender } = render(renderDialog(true));
    fireEvent.click(screen.getByText("Factors"));
    fireEvent.click(checkbox("financial_damage"));
    expect(checkbox("financial_damage").checked).toBe(false);

    rerender(renderDialog(false)); // Cancel closes the dialog
    rerender(renderDialog(true));
    fireEvent.click(screen.getByText("Factors"));
    expect(checkbox("financial_damage").checked).toBe(true);
  });

  it("reset impact restores the Asset Tab's impact set, not 'all off'", () => {
    const onSave = vi.fn();
    render(renderDialog(true, onSave));
    fireEvent.click(screen.getByText("Factors"));
    fireEvent.click(checkbox("operational")); // analyst switched one off
    fireEvent.click(checkbox("privacy")); // and one on
    fireEvent.click(screen.getByTestId("reset-factors-impact"));
    expect(checkbox("financial_damage").checked).toBe(true);
    expect(checkbox("operational").checked).toBe(true);
    expect(checkbox("privacy").checked).toBe(false);

    fireEvent.click(screen.getByText("Save"));
    const saved = onSave.mock.calls[0][0] as RiskConfiguration;
    const op = saved.activeFactors.find((f) => f.factorId === "operational")!;
    expect(op).toMatchObject({ enabled: true, autoEnabled: true });
  });

  it("under the asset weight source, reset also restores the asset weights", () => {
    const onSave = vi.fn();
    render(renderDialog(true, onSave, { financial_damage: 0.6, operational: 0.4 }));
    fireEvent.click(screen.getByText("Factors"));
    fireEvent.click(screen.getByTestId("reset-factors-impact"));
    fireEvent.click(screen.getByText("Save"));
    const saved = onSave.mock.calls[0][0] as RiskConfiguration;
    expect(saved.activeFactors.find((f) => f.factorId === "financial_damage")).toMatchObject({
      weight: 0.6,
      weightManual: false,
    });
  });
});
