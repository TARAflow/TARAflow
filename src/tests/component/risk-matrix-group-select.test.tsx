// Leveled-DFD Phase 6f (design §10): the risk matrix shows all risks or
// those of one group — top level or a top-level decomposed multiprocess.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TOP_LEVEL_GROUP, type DfdTableGroups } from "shared";
import { RiskMatrixGroupSelect } from "features/risks/components/risk-matrix-group-select";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const GROUPS: DfdTableGroups = {
  groups: [
    { key: TOP_LEVEL_GROUP, label: "" },
    { key: "mp1", label: "MP-1 Sensor Head" },
    { key: "mp3", label: "MP-3 Smoke Detector Controller" },
  ],
  elementGroup: {},
  flowGroups: {},
};

describe("RiskMatrixGroupSelect", () => {
  it("renders nothing for a classic DFD", () => {
    const { container } = render(<RiskMatrixGroupSelect value="" onChange={vi.fn()} />);
    expect(container.innerHTML).toBe("");
  });

  it("offers All, Top level and the multiprocess groups", () => {
    const onChange = vi.fn();
    render(<RiskMatrixGroupSelect groups={GROUPS} value="" onChange={onChange} />);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "All",
      "Top level",
      "MP-1 Sensor Head",
      "MP-3 Smoke Detector Controller",
    ]);
    fireEvent.click(screen.getByRole("option", { name: "MP-3 Smoke Detector Controller" }));
    expect(onChange).toHaveBeenCalledWith("mp3");
  });
});
