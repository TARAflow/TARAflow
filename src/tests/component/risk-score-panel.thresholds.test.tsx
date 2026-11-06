// src/tests/component/risk-score-panel.thresholds.test.tsx
//
// MT-3: the score panel in the risk dialog names and colors the risk value
// by the project's own severity thresholds — the same level as matrix,
// table and report.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskScorePanel } from "features/risks/components/shared/risk-score-panel";
import { DEFAULT_CONFIGURATION } from "features/risks/models/risk-config-types";
import { getRiskColor } from "features/risks/models/risk-scale-types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const riskBox = () => screen.getByText("Risk Score").closest(".MuiPaper-root") as HTMLElement;

const rgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
};

describe("RiskScorePanel — severity thresholds (MT-3)", () => {
  it("default thresholds: risk 4 on the 4-level scale is Medium", () => {
    render(<RiskScorePanel impact={2} likelihood={2} risk={4} configuration={DEFAULT_CONFIGURATION} />);
    expect(riskBox()).toHaveTextContent("Medium");
  });

  it("the project's thresholds win: label and color", () => {
    const configuration = { ...DEFAULT_CONFIGURATION, severityThresholds: { 1: 1, 2: 2, 3: 3 } };
    render(<RiskScorePanel impact={2} likelihood={2} risk={4} configuration={configuration} />);
    expect(riskBox()).toHaveTextContent("Critical");
    expect(getComputedStyle(riskBox()).backgroundColor).toBe(rgb(getRiskColor(4, configuration)));
  });
});
