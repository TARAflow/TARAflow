// src/tests/component/risk-config-dialog.impact-aggregation.test.tsx
//
// Design §6: the impact aggregation is chosen in the risk configuration; a
// change is previewed (every changed risk, level changes marked) before
// Save applies it. A legacy project that keeps the weighted mean keeps its
// configuration without the field — no silent change.

import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RiskConfigDialog } from "features/risks/components/risk-config-dialog";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import type { RiskData } from "features/risks/models/risk-assessment-types";

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

const riskData = {
  configuration: { ...DEFAULT_CONFIGURATION },
  risks: [
    {
      id: "r1",
      threatDisplayId: "P1-T-1",
      factorRatings: [
        { factorId: "safety", value: 4, weight: 1 },
        { factorId: "financial_damage", value: 1, weight: 1 },
        { factorId: "operational", value: 1, weight: 1 },
        { factorId: "privacy", value: 1, weight: 1 },
        { factorId: "skill_level", value: 4, weight: 1 },
      ],
    },
  ],
  lastModified: "",
} as unknown as RiskData;

function open(onSave = vi.fn(), assetImpactWeights?: Record<string, number>) {
  render(
    <RiskConfigDialog
      open
      configuration={riskData.configuration}
      onSave={onSave}
      onClose={() => {}}
      riskData={riskData}
      recommendedImpactAggregation="harm-floor"
      assetImpactWeights={assetImpactWeights}
    />,
  );
  return onSave;
}

describe("RiskConfigDialog — impact aggregation", () => {
  it("legacy project: weighted mean is current, the preset recommendation is offered", () => {
    open();
    const section = screen.getByTestId("impact-aggregation-section");
    expect(within(section).getByText("The regulation preset recommends: Harm floor")).toBeTruthy();
    expect(screen.queryByTestId("impact-aggregation-preview")).toBeNull();
  });

  it("choosing the recommendation previews the changed risks; Save applies it", () => {
    const onSave = open();
    fireEvent.click(screen.getByTestId("impact-aggregation-use-recommended"));
    const preview = screen.getByTestId("impact-aggregation-preview");
    expect(preview).toHaveTextContent("1 risk(s) change, 1 of them their risk level.");
    expect(within(screen.getByTestId("impact-change-r1")).getByText("1.8 → 4")).toBeTruthy();
    fireEvent.click(screen.getByText("Save"));
    expect(onSave.mock.calls[0][0].impactAggregation).toBe("harm-floor");
  });

  it("keeping the weighted mean stores nothing new (no silent change)", () => {
    const onSave = open();
    fireEvent.click(screen.getByText("Save"));
    expect("impactAggregation" in onSave.mock.calls[0][0]).toBe(false);
  });
});

// Phase 4 (§5.3): asset weights as the default for impact, overridable here.
describe("RiskConfigDialog — impact weights from the asset configuration", () => {
  const ASSET = { safety: 0.4, financial_damage: 0.2, operational: 0.2, privacy: 0.2 };

  it("without asset weights the option is disabled", () => {
    open();
    expect(screen.getByTestId("impact-weights-from-asset")).toBeDisabled();
  });

  it("switching previews the change; Save stores the source and the asset weights", () => {
    const onSave = open(vi.fn(), ASSET);
    fireEvent.click(screen.getByTestId("impact-weights-from-asset"));
    // (4·0.4 + 3·1·0.2) / 1 = 2.2 instead of 1.75 (→ 1.8)
    expect(within(screen.getByTestId("impact-change-r1")).getByText("1.8 → 2.2")).toBeTruthy();
    fireEvent.click(screen.getByText("Save"));
    const saved = onSave.mock.calls[0][0];
    expect(saved.impactWeightSource).toBe("asset");
    expect(saved.activeFactors.find((f: { factorId: string }) => f.factorId === "safety").weight).toBe(0.4);
    expect("impactAggregation" in saved).toBe(false);
  });

  it("asset mode: the asset weight is shown as default; moving the slider overrides, reset returns", () => {
    const assetMode = {
      ...riskData,
      configuration: {
        ...riskData.configuration,
        impactWeightSource: "asset" as const,
        activeFactors: riskData.configuration.activeFactors.map((f) =>
          f.factorId === "safety" ? { ...f, enabled: true } : f,
        ),
      },
    };
    const onSave = vi.fn();
    render(
      <RiskConfigDialog
        open
        configuration={assetMode.configuration}
        onSave={onSave}
        onClose={() => {}}
        riskData={assetMode}
        assetImpactWeights={ASSET}
      />,
    );
    fireEvent.click(screen.getByText("Factors"));
    const tag = screen.queryAllByTestId("impact-weight-asset-safety");
    expect(tag.length).toBeGreaterThan(0);
    const slider = tag[0].parentElement!.querySelector('input[type="range"]') as HTMLInputElement;
    expect(slider.value).toBe("0.4");
    fireEvent.change(slider, { target: { value: "0.8" } });
    fireEvent.click(screen.getByTestId("impact-weight-reset-safety"));
    expect(screen.getByTestId("impact-weight-asset-safety")).toBeTruthy();
    const again = screen.getByTestId("impact-weight-asset-safety").parentElement!
      .querySelector('input[type="range"]') as HTMLInputElement;
    expect(again.value).toBe("0.4");
    fireEvent.change(again, { target: { value: "0.8" } });
    expect(screen.getByTestId("impact-weight-reset-safety")).toBeTruthy();
    fireEvent.click(screen.getByText("Save"));
    const safety = onSave.mock.calls[0][0].activeFactors.find((f: { factorId: string }) => f.factorId === "safety");
    expect(safety).toMatchObject({ weight: 0.8, weightManual: true });
  });

  it("keeping the own weights stores nothing new", () => {
    const onSave = open(vi.fn(), ASSET);
    fireEvent.click(screen.getByText("Save"));
    expect("impactWeightSource" in onSave.mock.calls[0][0]).toBe(false);
  });
});
