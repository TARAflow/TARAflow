// src/tests/component/dfd-page-tree.test.tsx
//
// Leveled-DFD Phase 5c (leveled-dfd-multi-diagram-design.md §12): the page
// tree in the DFD tab.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DFDPageTree } from "features/dfd/components/dfd-page-tree";
import type { PageOutline } from "features/dfd/services/leveled";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const OUTLINE: PageOutline = {
  firstPageId: "sys",
  nodes: [
    { pageId: "sys", name: "System", depth: 0, pendingDecomposition: false, errors: 2, warnings: 0 },
    {
      pageId: "sen",
      name: "Sensor Module",
      depth: 1,
      decomposes: { tfId: "mp1", label: "MP-1 Sensor Module" },
      pendingDecomposition: false,
      errors: 0,
      warnings: 3,
    },
    {
      pageId: "ctl",
      name: "Controller Module",
      depth: 1,
      decomposes: { tfId: "mp2", label: "MP-2 Controller Module" },
      pendingDecomposition: true,
      errors: 0,
      warnings: 0,
    },
    { pageId: "p4", name: "Page-4", pendingDecomposition: false, errors: 0, warnings: 0 },
  ],
};

describe("DFDPageTree", () => {
  it("shows pages, detailed multiprocesses and finding counts", () => {
    render(<DFDPageTree outline={OUTLINE} currentPageId="sen" onSelectPage={vi.fn()} />);
    expect(screen.getByText("System")).toBeTruthy();
    expect(screen.getByText("MP-1 Sensor Module")).toBeTruthy();
    expect(screen.getByTestId("page-tree-errors-sys").textContent).toBe("2");
    expect(screen.getByTestId("page-tree-warnings-sen").textContent).toBe("3");
    expect(screen.queryByTestId("page-tree-errors-sen")).toBeNull();
  });

  it("highlights the current page", () => {
    render(<DFDPageTree outline={OUTLINE} currentPageId="sen" onSelectPage={vi.fn()} />);
    expect(screen.getByTestId("page-tree-sen").className).toContain("Mui-selected");
    expect(screen.getByTestId("page-tree-sys").className).not.toContain("Mui-selected");
  });

  it("explains a decomposition that is not in effect yet and an unplaced page", () => {
    render(<DFDPageTree outline={OUTLINE} currentPageId={null} onSelectPage={vi.fn()} />);
    expect(
      within(screen.getByTestId("page-tree-ctl")).getByText(/analysed as a whole/),
    ).toBeTruthy();
    expect(within(screen.getByTestId("page-tree-p4")).getByText("not in the page tree")).toBeTruthy();
  });

  it("opens a page on click", () => {
    const onSelectPage = vi.fn();
    render(<DFDPageTree outline={OUTLINE} currentPageId="sys" onSelectPage={onSelectPage} />);
    fireEvent.click(screen.getByText("Controller Module"));
    expect(onSelectPage).toHaveBeenCalledWith("ctl");
  });
});
