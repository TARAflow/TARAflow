// src/tests/component/project-settings-dfd-badges.test.tsx
//
// "Show exposure levels in the diagram" (0.20 patch 24): without a choice the
// checkbox follows the EN 50742 tag and says so; a click stores the choice.

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectSettings } from "features/overview/components/project-settings";
import type { ProjectSettingsData } from "features/overview";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.defaultValue as string | undefined) ?? k,
    i18n: { language: "en", exists: () => false },
  }),
}));

afterEach(cleanup);

const base: ProjectSettingsData = { strictMode: false, autoSave: true, autoSaveInterval: 2 };
const checkbox = () => screen.getByLabelText(/Show exposure levels in the diagram/) as HTMLInputElement;

describe("ProjectSettings — EL badges", () => {
  it("no choice: on in an EN 50742 project, off otherwise; the default is explained", () => {
    render(<ProjectSettings settings={base} onUpdate={vi.fn()} en50742 />);
    expect(checkbox().checked).toBe(true);
    expect(screen.getByTestId("dfd-badges-default")).toBeTruthy();
    cleanup();
    render(<ProjectSettings settings={base} onUpdate={vi.fn()} />);
    expect(checkbox().checked).toBe(false);
  });

  it("a click stores the choice; a stored choice wins over the tag and hides the hint", () => {
    const onUpdate = vi.fn();
    render(<ProjectSettings settings={base} onUpdate={onUpdate} />);
    fireEvent.click(checkbox());
    expect(onUpdate).toHaveBeenCalledWith({ ...base, dfdBadges: true });
    cleanup();
    render(<ProjectSettings settings={{ ...base, dfdBadges: false }} onUpdate={vi.fn()} en50742 />);
    expect(checkbox().checked).toBe(false);
    expect(screen.queryByTestId("dfd-badges-default")).toBeNull();
  });
});
