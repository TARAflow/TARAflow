// src/tests/component/dfd-notification-panel.infos.test.tsx
//
// Leveled-DFD Phase 4a (leveled-dfd-multi-diagram-design.md §7): the DFD
// notification panel shows the new info severity like the asset panel —
// errors and warnings by default, infos behind their chip.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DFDNotificationsPanel } from "features/dfd/components/dfd-notification-panel";
import type { ValidationResult } from "features/dfd/services/dfd-validator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

const validation: ValidationResult = {
  isValid: false,
  isComplete: false,
  scenario: null,
  errors: [{ key: "k.error" }],
  warnings: [{ key: "k.warning" }],
  infos: [
    { key: "dfdValidation.leveled.BAL_UNRESOLVED_ENDPOINT", displayId: "DF-7" },
  ],
};

describe("DFDNotificationsPanel — infos", () => {
  it("hides infos until their chip is clicked, then shows only them", () => {
    render(<DFDNotificationsPanel validation={validation} />);
    expect(screen.getByText("k.error")).toBeTruthy();
    expect(screen.getByText("k.warning")).toBeTruthy();
    expect(screen.queryByText("DF-7")).toBeNull();

    fireEvent.click(screen.getByTestId("dfd-notification-info-toggle"));
    expect(screen.getByText("DF-7")).toBeTruthy();
    expect(screen.queryByText("k.error")).toBeNull();

    fireEvent.click(screen.getByTestId("dfd-notification-info-toggle"));
    expect(screen.queryByText("DF-7")).toBeNull();
    expect(screen.getByText("k.error")).toBeTruthy();
  });

  it("renders when there are only infos", () => {
    render(
      <DFDNotificationsPanel
        validation={{ ...validation, errors: [], warnings: [] }}
      />,
    );
    expect(screen.getByTestId("dfd-notification-info-toggle")).toBeTruthy();
  });
});
