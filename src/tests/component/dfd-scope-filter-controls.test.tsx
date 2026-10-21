// Leveled-DFD Phase 6f (design §10): page and analysis-state filter in the
// filter bars of the threat and risk tables.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DfdScopeFilterControls, NO_DFD_SCOPE_FILTER, type DfdScopeIndex } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const INDEX: DfdScopeIndex = {
  pages: [
    { pageId: "top", name: "Top", depth: 0 },
    { pageId: "sen", name: "Sensor", depth: 1 },
  ],
  itemsOnPage: { top: [], sen: [] },
  childPages: { top: ["sen"] },
  parentLevelFlows: ["df1", "df2"],
  multiprocesses: [],
};

describe("DfdScopeFilterControls", () => {
  it("renders nothing for a classic DFD", () => {
    const { container } = render(
      <DfdScopeFilterControls filter={NO_DFD_SCOPE_FILTER} onChange={vi.fn()} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("offers the pages and the parent-level filter with its count", () => {
    const onChange = vi.fn();
    render(<DfdScopeFilterControls index={INDEX} filter={NO_DFD_SCOPE_FILTER} onChange={onChange} />);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["All pages", "Top", "Sensor"]);
    fireEvent.click(screen.getByRole("option", { name: "Sensor" }));
    expect(onChange).toHaveBeenCalledWith({ ...NO_DFD_SCOPE_FILTER, pageId: "sen" });

    fireEvent.click(screen.getByLabelText("parent-level-only"));
    expect(onChange).toHaveBeenLastCalledWith({ ...NO_DFD_SCOPE_FILTER, parentLevelOnly: true });
    expect(screen.getByText("Only flows analysed on parent level (2)")).toBeTruthy();
  });

  it("offers 'with sub-pages' only for a page that has some", () => {
    const { rerender } = render(
      <DfdScopeFilterControls index={INDEX} filter={{ ...NO_DFD_SCOPE_FILTER, pageId: "sen" }} onChange={vi.fn()} />,
    );
    expect(screen.queryByLabelText("with-sub-pages")).toBeNull();
    rerender(
      <DfdScopeFilterControls index={INDEX} filter={{ ...NO_DFD_SCOPE_FILTER, pageId: "top" }} onChange={vi.fn()} />,
    );
    expect(screen.getByLabelText("with-sub-pages")).toBeTruthy();
  });
});
