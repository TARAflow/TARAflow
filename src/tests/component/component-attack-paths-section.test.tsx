// src/tests/component/component-attack-paths-section.test.tsx
// Multi-project TARA, patch 17: the window of opportunity of an imported
// component's attack path, rated per instance and path in the Attack Tree tab.
import React from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ComponentAttackPathsSection } from "features/components";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      ((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n) => String(o?.[n] ?? "")),
    i18n: { language: "en" },
  }),
}));
afterEach(cleanup);

const groups = [
  {
    key: "inst",
    label: "HL1 · Headlamp",
    paths: [
      { treeKey: "t1", treeName: "Spoof light command", pathKey: "p1", path: ["root", "CAN", "inject"], componentWindow: "difficult" as const, feasibility: "very-low", ratable: true },
      { treeKey: "t1", treeName: "Spoof light command", pathKey: "p2", path: ["root", "OBD"], componentWindow: "moderate" as const, machineWindow: "easy" as const, feasibility: "medium", ratable: true },
      { treeKey: "t2", treeName: "Quick tree", pathKey: "p3", path: ["root", "x"], ratable: false },
    ],
  },
];

describe("ComponentAttackPathsSection", () => {
  it("counts the paths still to rate and lists the component's and the machine's values", () => {
    render(<ComponentAttackPathsSection groups={groups} onSetWindow={vi.fn()} />);
    expect(screen.getByTestId("component-attack-paths").textContent).toContain("(3) — window of opportunity to rate: 1");
    fireEvent.click(screen.getByText(/Attack paths from imported components/));
    expect(screen.getByTestId("component-path-p1").textContent).toContain("CAN → inject");
    expect(screen.getByTestId("component-path-p3").textContent).toContain("quick mode");
  });

  it("rating a path calls back with instance, tree and path; empty removes it", async () => {
    const onSet = vi.fn();
    render(<ComponentAttackPathsSection groups={groups} onSetWindow={onSet} />);
    fireEvent.click(screen.getByText(/Attack paths from imported components/));
    const select = screen.getByTestId("component-path-window-p1").parentElement!.querySelector('[role="combobox"]')!;
    await act(async () => { fireEvent.mouseDown(select); });
    await act(async () => { fireEvent.click(within(screen.getByRole("listbox")).getByText("unlimited")); });
    expect(onSet).toHaveBeenCalledWith("inst", "t1", "p1", "unlimited");
    const second = screen.getByTestId("component-path-window-p2").parentElement!.querySelector('[role="combobox"]')!;
    await act(async () => { fireEvent.mouseDown(second); });
    await act(async () => { fireEvent.click(within(screen.getByRole("listbox")).getByText(/not rated/)); });
    expect(onSet).toHaveBeenLastCalledWith("inst", "t1", "p2", null);
  });

  it("nothing without paths", () => {
    const { container } = render(<ComponentAttackPathsSection groups={[]} onSetWindow={vi.fn()} />);
    expect(container.textContent).toBe("");
  });
});
