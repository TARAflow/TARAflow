// src/tests/component/lost-definition-dialog.test.tsx
//
// Leveled-DFD Phase 5k (leveled-dfd-multi-diagram-design.md §5.2): the
// question when a linked definition was deleted or drawn again.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LostDefinitionDialog } from "features/dfd/components/lost-definition-dialog";
import type { LostDefinition } from "features/dfd/services/leveled";
import type { LeveledActionError } from "features/dfd/models/leveled-errors";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const LOST: LostDefinition = {
  kind: "element",
  tfId: "tx",
  label: "P-3 Logger",
  type: "Process",
  pageId: "sys",
  pageName: "Top",
  record: { id: "tx", assetRelations: [{}, {}] } as never,
  candidates: [
    { cellId: "cy", label: "P-3 Logger" },
    { cellId: "cz", label: "P-4 Other" },
  ],
};

const handlers = () => ({
  onReattach: vi.fn(async (_t: string, _c: string): Promise<LeveledActionError | null> => null),
  onAccept: vi.fn(),
  onLater: vi.fn(),
});

describe("LostDefinitionDialog", () => {
  it("names the element, what refers to it, and re-attaches to the first candidate", async () => {
    const h = handlers();
    render(<LostDefinitionDialog lost={[LOST]} threatCountOf={() => 7} {...h} />);
    expect(screen.getByText(/"P-3 Logger" on page "Top" was deleted or drawn again/)).toBeTruthy();
    expect(screen.getByTestId("lost-definition-usage").textContent).toMatch(/^7 threat\(s\) and 2 asset relation\(s\)/);
    fireEvent.click(screen.getByTestId("lost-definition-reattach"));
    await vi.waitFor(() => expect(h.onReattach).toHaveBeenCalledWith("tx", "cy"));
  });

  it("accepts the deletion or puts it off", () => {
    const h = handlers();
    render(<LostDefinitionDialog lost={[LOST]} {...h} />);
    fireEvent.click(screen.getByTestId("lost-definition-accept"));
    expect(h.onAccept).toHaveBeenCalledWith("tx");
    fireEvent.click(screen.getByTestId("lost-definition-later"));
    expect(h.onLater).toHaveBeenCalledWith("tx");
  });

  it("without a new cell it explains how to go on, re-attach disabled", () => {
    render(<LostDefinitionDialog lost={[{ ...LOST, candidates: [] }]} {...handlers()} />);
    expect(screen.getByTestId("lost-definition-no-candidate")).toBeTruthy();
    expect((screen.getByTestId("lost-definition-reattach") as HTMLButtonElement).disabled).toBe(true);
  });

  it("renders nothing without a lost definition", () => {
    const { container } = render(<LostDefinitionDialog lost={[]} {...handlers()} />);
    expect(container.innerHTML).toBe("");
  });
});
