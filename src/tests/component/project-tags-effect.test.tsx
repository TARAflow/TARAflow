// src/tests/component/project-tags-effect.test.tsx
//
// Tags that change the workflow stand out in the tag editor, not by colour
// alone: method tags dark with a cog, matrix tags outlined with a shield, in
// the selected tags and in the list to choose from; a legend explains both.

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectTagsEditor } from "shared/components/project-tags-editor";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.defaultValue as string | undefined) ?? k,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const tags = { domain: ["Industrial"], platform: [], custom: [], regulation: ["ISO 21434", "EN IEC 62443 (CRA)", "CRA"] };
/** The effect of the tag pill (selected badge or choice button) showing `text`. */
const effect = (text: string) => {
  const pills = Array.from(document.querySelectorAll<HTMLElement>("span.rounded-full, button.rounded-full"));
  const pill = pills.find((p) => (p.textContent ?? "").replace(/^\+\s*/, "").trim() === text);
  if (!pill) throw new Error(`no tag pill ${text}`);
  return pill.getAttribute("data-tag-effect");
};

describe("ProjectTagsEditor — tags that change the workflow", () => {
  it("selected tags: method dark with a cog, matrix outlined with a shield, the rest as before", () => {
    render(<ProjectTagsEditor tags={tags} editing={false} onChange={vi.fn()} />);
    expect(effect("ISO 21434")).toBe("method");
    expect(effect("EN IEC 62443 (CRA)")).toBe("matrix");
    expect(effect("CRA")).toBeNull();
    expect(effect("Industrial")).toBeNull();
    expect(screen.getAllByTestId("tag-effect-method")).toHaveLength(1);
    expect(screen.getAllByTestId("tag-effect-matrix")).toHaveLength(1);
  });

  it("the list to choose from carries the same marks, and a legend explains them", () => {
    render(<ProjectTagsEditor tags={{ domain: [], platform: [], custom: [], regulation: [] }} editing onChange={vi.fn()} />);
    expect(effect("ETSI TVRA")).toBe("method");
    expect(effect("IEC 62443")).toBe("matrix");
    expect(effect("NIS2")).toBeNull();
    const legend = screen.getByTestId("tag-effect-legend");
    expect(legend.textContent).toContain("defines the method");
    expect(legend.textContent).toContain("enables the requirement matrix");
  });
});
