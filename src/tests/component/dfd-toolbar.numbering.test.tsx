// src/tests/component/dfd-toolbar.numbering.test.tsx
//
// Leveled-DFD Phase 5l (leveled-dfd-multi-diagram-design.md §8): in a
// leveled DFD the numbering button offers "all pages" or "this page and
// its child pages"; a classic DFD keeps the one-click button.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DFDToolbar } from "features/dfd/components/dfd-toolbar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: Record<string, unknown> & { defaultValue?: string }) =>
      (o?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name) => String(o?.[name] ?? "")),
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const base = () => ({
  viewMode: "draw" as const,
  onViewModeChange: vi.fn(),
  isDirty: false,
  validation: null,
  stats: null,
  darkMode: false,
  onToggleDarkMode: vi.fn(),
  onExportImage: vi.fn(),
  onRefresh: vi.fn(),
  onAutoNumber: vi.fn(),
  onAutoNumberConfig: vi.fn(),
  onExport: vi.fn(),
  onImport: vi.fn(),
  onSave: vi.fn(),
});

describe("DFDToolbar — numbering", () => {
  it("numbers at once in a classic DFD", () => {
    const props = base();
    render(<DFDToolbar {...props} />);
    fireEvent.click(screen.getByTestId("toolbar-auto-number"));
    expect(props.onAutoNumber).toHaveBeenCalled();
    expect(screen.queryByTestId("auto-number-page")).toBeNull();
  });

  it("offers all pages or the page shown in a leveled DFD", () => {
    const props = base();
    const onAutoNumberPage = vi.fn();
    render(
      <DFDToolbar
        {...props}
        onAutoNumberPage={onAutoNumberPage}
        getCurrentPageName={() => "Sensor Module"}
      />,
    );
    fireEvent.click(screen.getByTestId("toolbar-auto-number"));
    expect(props.onAutoNumber).not.toHaveBeenCalled();
    expect(screen.getByTestId("auto-number-page").textContent).toBe(
      'Renumber "Sensor Module" and its child pages',
    );
    fireEvent.click(screen.getByTestId("auto-number-page"));
    expect(onAutoNumberPage).toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("toolbar-auto-number"));
    fireEvent.click(screen.getByTestId("auto-number-all"));
    expect(props.onAutoNumber).toHaveBeenCalled();
  });

  it("this page is disabled while its multiprocess has no number", () => {
    const props = base();
    const onAutoNumberPage = vi.fn();
    render(
      <DFDToolbar
        {...props}
        onAutoNumberPage={onAutoNumberPage}
        getCurrentPageName={() => "Controller Module"}
        getPageNumberingBlocker={() => "Controller Module"}
      />,
    );
    fireEvent.click(screen.getByTestId("toolbar-auto-number"));
    const item = screen.getByTestId("auto-number-page");
    expect(item.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByTestId("auto-number-page-blocked").textContent).toBe(
      '"Controller Module" has no number yet — renumber all pages first',
    );
    fireEvent.click(item);
    expect(onAutoNumberPage).not.toHaveBeenCalled();
  });
});
