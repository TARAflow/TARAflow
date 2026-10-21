// Leveled-DFD Phase 6f (design §10): roll-up per decomposed multiprocess
// below the risk matrix.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RiskRollupSection } from "features/risks/components/risk-rollup-section";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const ROWS = [
  { tfId: "mp1", label: "MP-1 Sensor", depth: 0, counts: [0, 1, 1, 0, 1], max: 4, threats: 3 },
  { tfId: "mp11", label: "MP-1.1 Optics", depth: 1, counts: [0, 0, 0, 0, 0], threats: 1 },
];

describe("RiskRollupSection", () => {
  it("renders nothing without decomposed multiprocesses", () => {
    const { container } = render(
      <RiskRollupSection rows={[]} configuration={{ scale: "5-level" }} mode="before" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows per multiprocess the counts (highest level first), the highest level and the threats", () => {
    render(<RiskRollupSection rows={ROWS} configuration={{ scale: "5-level" }} mode="after" />);
    expect(screen.getByText("(after mitigation)")).toBeTruthy();
    fireEvent.click(screen.getByText("Roll-up per multiprocess"));
    const mp1 = within(screen.getByTestId("risk-rollup-mp1")).getAllByRole("cell").map((c) => c.textContent);
    expect(mp1[0]).toBe("MP-1 Sensor");
    expect(mp1.slice(1, 6)).toEqual(["1", "–", "1", "1", "–"]);
    expect(mp1[7]).toBe("3");
    const mp11 = within(screen.getByTestId("risk-rollup-mp11")).getAllByRole("cell").map((c) => c.textContent);
    expect(mp11[6]).toBe("not rated");
  });
});
