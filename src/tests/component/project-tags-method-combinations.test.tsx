// src/tests/component/project-tags-method-combinations.test.tsx
//
// One base method per project, EN 50742 A as an addition (user 2026-11-21):
// adding a tag that cannot go with another one replaces it and says so;
// the bare "EN 50742" is refused with the request to choose A or B.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectTagsEditor } from "shared/components/project-tags-editor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      String((o?.defaultValue as string | undefined) ?? k).replace(/\{\{(\w+)\}\}/g, (_, n: string) => String(o?.[n] ?? "")),
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const choose = (text: string) => {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button.rounded-full")).find(
    (b) => (b.textContent ?? "").replace(/^\+\s*/, "").trim() === text,
  );
  if (!button) throw new Error(`no choice ${text}`);
  fireEvent.click(button);
};

describe("ProjectTagsEditor — method tag combinations", () => {
  it("EN 50742 B replaces A and says so", () => {
    const onChange = vi.fn();
    render(<ProjectTagsEditor tags={{ domain: [], platform: [], custom: [], regulation: ["EN 50742 A"] }} editing onChange={onChange} />);
    choose("EN 50742 B");
    expect(onChange).toHaveBeenCalledWith({ domain: [], platform: [], custom: [], regulation: ["EN 50742 B", "IEC 62443"] });
    expect(screen.getByTestId("tag-notice").textContent).toContain("EN 50742 B replaces EN 50742 A");
  });

  it("ETSI TVRA next to EN 50742 A: added, no notice", () => {
    const onChange = vi.fn();
    render(<ProjectTagsEditor tags={{ domain: [], platform: [], custom: [], regulation: ["EN 50742 A"] }} editing onChange={onChange} />);
    choose("ETSI TVRA");
    expect(onChange).toHaveBeenCalledWith({ domain: [], platform: [], custom: [], regulation: ["EN 50742 A", "ETSI TVRA"] });
    expect(screen.queryByTestId("tag-notice")).toBeNull();
  });

  it("the bare EN 50742 typed as a free tag is refused", () => {
    const onChange = vi.fn();
    render(<ProjectTagsEditor tags={{ domain: [], platform: [], custom: [], regulation: [] }} editing onChange={onChange} />);
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "EN 50742" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("tag-notice").textContent).toContain("Choose the approach");
  });
});
