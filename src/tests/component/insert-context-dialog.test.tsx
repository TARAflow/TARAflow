// src/tests/component/insert-context-dialog.test.tsx
//
// Leveled-DFD Phase 5h (leveled-dfd-multi-diagram-design.md §5.2, §12):
// "Insert as context…" on the current page.
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  InsertContextDialog,
  categoriesOf,
} from "features/dfd/components/insert-context-dialog";
import type { InsertCandidate } from "features/dfd/services/leveled";
import type { LeveledActionError } from "features/dfd/models/leveled-errors";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const CANDIDATES: InsertCandidate[] = [
  { kind: "connection", tfId: "df8", label: "DF-8 commands", type: "DataFlow", definitionPageId: "sys" },
  { kind: "element", tfId: "ee1", label: "EE-1 Debugger", type: "ExternalEntity", definitionPageId: "sys" },
  { kind: "element", tfId: "ee2", label: "EE-2 Fire Panel", type: "ExternalEntity", definitionPageId: "sys" },
  { kind: "element", tfId: "p3", label: "P-3 Logger", type: "Process", definitionPageId: "sys" },
];

const renderDialog = (onInsert = vi.fn(async (): Promise<LeveledActionError | null> => null), candidates = CANDIDATES) => {
  const onClose = vi.fn();
  render(
    <InsertContextDialog
      open
      pageName="MyProcess"
      candidates={candidates}
      pageNames={{ sys: "Top" }}
      onInsert={onInsert}
      onClose={onClose}
    />,
  );
  return { onInsert, onClose };
};

describe("categoriesOf", () => {
  it("orders the categories like the DFD palette, flows after the elements", () => {
    expect(categoriesOf(CANDIDATES)).toEqual(["ExternalEntity", "Process", "DataFlow"]);
  });
});

describe("InsertContextDialog", () => {
  it("shows one tab per category with its count, the first one open", () => {
    renderDialog();
    expect(screen.getByText('Insert as context on "MyProcess"')).toBeTruthy();
    const tabs = within(screen.getByTestId("insert-context-categories")).getAllByRole("tab");
    expect(tabs.map((t) => t.textContent)).toEqual([
      "ExternalEntity (2)",
      "Process (1)",
      "DataFlow (1)",
    ]);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
  });

  it("lists only the elements of the chosen category and inserts one", async () => {
    const { onInsert, onClose } = renderDialog();
    expect((screen.getByTestId("insert-context-apply") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "EE-1 Debuggerdefined on Top",
      "EE-2 Fire Paneldefined on Top",
    ]);
    fireEvent.click(screen.getByText("EE-2 Fire Panel"));
    fireEvent.click(screen.getByTestId("insert-context-apply"));
    await vi.waitFor(() => expect(onInsert).toHaveBeenCalledWith(CANDIDATES[2]));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("switching the category shows its elements and clears the choice", () => {
    renderDialog();
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("EE-1 Debugger"));
    fireEvent.click(screen.getByTestId("insert-context-category-DataFlow"));
    expect((screen.getByTestId("insert-context-apply") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "DF-8 commandsdefined on Top",
    ]);
  });

  it("stays open and shows why nothing was inserted", async () => {
    const { onClose } = renderDialog(vi.fn(async (): Promise<LeveledActionError | null> => "DRAWIO_FAILED"));
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("EE-1 Debugger"));
    fireEvent.click(screen.getByTestId("insert-context-apply"));
    expect((await screen.findByTestId("insert-context-error")).textContent).toContain("DRAWIO_FAILED");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says so when everything is already on the page", () => {
    renderDialog(undefined, []);
    expect(screen.getByText(/already shown on this page/)).toBeTruthy();
    expect(screen.queryByTestId("insert-context-categories")).toBeNull();
  });
});
