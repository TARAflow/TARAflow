// src/tests/component/dfd-preview-panel.pages.test.tsx
//
// Leveled DFD (leveled-dfd-multi-diagram-design.md §12.1, D18): the DFD
// preview of the other tabs picks the page, Top first.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DFDPreviewPanel } from "shared";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const PAGES = [
  { pageId: "sys", name: "Top", thumbnail: "data:image/svg+xml;base64,dG9w" },
  { pageId: "sen", name: "Sensor Module", thumbnail: "data:image/svg+xml;base64,c2Vu" },
  { pageId: "ctl", name: "Controller" },
];

describe("DFDPreviewPanel — pages", () => {
  it("shows Top first and switches to another page", () => {
    render(<DFDPreviewPanel imageSrc="data:legacy" pages={PAGES} />);
    expect((screen.getByAltText("DFD Preview") as HTMLImageElement).src).toBe(PAGES[0].thumbnail);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Sensor Module" }));
    expect((screen.getByAltText("DFD Preview") as HTMLImageElement).src).toBe(PAGES[1].thumbnail);
  });

  it("says when a page has no preview yet and lets the user switch back", () => {
    render(<DFDPreviewPanel pages={PAGES} />);
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Controller" }));
    expect(screen.getByText("No DFD image available")).toBeTruthy();
    fireEvent.mouseDown(screen.getByRole("combobox"));
    fireEvent.click(screen.getByRole("option", { name: "Top" }));
    expect(screen.getByAltText("DFD Preview")).toBeTruthy();
  });

  it("has no page selector for a classic DFD", () => {
    render(<DFDPreviewPanel imageSrc="data:image/svg+xml;base64,eA==" />);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect((screen.getByAltText("DFD Preview") as HTMLImageElement).src).toBe(
      "data:image/svg+xml;base64,eA==",
    );
  });
});
