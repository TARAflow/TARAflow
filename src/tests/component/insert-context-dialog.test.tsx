// src/tests/component/insert-context-dialog.test.tsx
//
// Leveled-DFD Phase 5h (leveled-dfd-multi-diagram-design.md §5.2, §12):
// "Insert as context…" on the current page.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InsertContextDialog } from "features/dfd/components/insert-context-dialog";
import type { InsertCandidate } from "features/dfd/services/leveled";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const CANDIDATES: InsertCandidate[] = [
  { kind: "element", tfId: "ee1", label: "EE-1 Debugger", type: "ExternalEntity", definitionPageId: "sys" },
  { kind: "connection", tfId: "df8", label: "DF-8 commands", type: "DataFlow", definitionPageId: "sys" },
];

const renderDialog = (onInsert = vi.fn(async (): Promise<string | null> => null), candidates = CANDIDATES) => {
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

describe("InsertContextDialog", () => {
  it("names the page and inserts the chosen element", async () => {
    const { onInsert, onClose } = renderDialog();
    expect(screen.getByText('Insert as context on "MyProcess"')).toBeTruthy();
    expect((screen.getByTestId("insert-context-apply") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    expect(screen.getAllByText("defined on Top")).toHaveLength(2);
    fireEvent.click(screen.getByText("EE-1 Debugger"));
    fireEvent.click(screen.getByTestId("insert-context-apply"));
    await vi.waitFor(() => expect(onInsert).toHaveBeenCalledWith(CANDIDATES[0]));
    await vi.waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("stays open and shows why nothing was inserted", async () => {
    const { onClose } = renderDialog(vi.fn(async (): Promise<string | null> => "busy"));
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByText("DF-8 commands"));
    fireEvent.click(screen.getByTestId("insert-context-apply"));
    expect((await screen.findByTestId("insert-context-error")).textContent).toContain("busy");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says so when everything is already on the page", () => {
    renderDialog(undefined, []);
    expect(screen.getByText(/already shown on this page/)).toBeTruthy();
  });
});
