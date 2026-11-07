// src/tests/component/dfd-toolbar.component-import.test.tsx
//
// Multi-project TARA, phase 1 (design §5): the DFD toolbar offers "Import
// component TARA…" only when the app passes an import flow (Electron with
// the draw.io plugin).
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DFDToolbar } from "features/dfd/components/dfd-toolbar";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
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

describe("DFDToolbar — component import", () => {
  it("is not offered without an import flow", () => {
    render(<DFDToolbar {...base()} />);
    expect(screen.queryByTestId("toolbar-import-component")).toBeNull();
  });

  it("starts the import flow", () => {
    const onImportComponent = vi.fn();
    render(<DFDToolbar {...base()} onImportComponent={onImportComponent} />);
    fireEvent.click(screen.getByTestId("toolbar-import-component"));
    expect(onImportComponent).toHaveBeenCalledTimes(1);
  });
});
