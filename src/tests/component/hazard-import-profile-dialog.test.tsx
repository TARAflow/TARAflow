// Hazard import HI-2: the profile dialog warns when no affected person can be
// determined — no person column and no default — because then no severity
// reaches a person; a default clears the warning.
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HazardImportProfileDialog } from "features/hazards/components/hazard-import-profile-dialog";
import fixture from "../fixtures/hazards/label-applicator-iso12100.json";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

describe("HazardImportProfileDialog — affected persons", () => {
  it("warns without person column and default; a default clears it", () => {
    render(
      <HazardImportProfileDialog
        open
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        workbook={fixture as any}
        fileName="la200.xlsx"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId("no-persons-warning")).toBeTruthy();

    const input = screen.getByTestId("default-persons") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Operator, Setter" } });
    fireEvent.blur(input);
    expect(screen.queryByTestId("no-persons-warning")).toBeNull();
  });

  it("the list separator field shows the default , and /", () => {
    render(
      <HazardImportProfileDialog
        open
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        workbook={fixture as any}
        fileName="la200.xlsx"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect((screen.getByTestId("list-separator") as HTMLInputElement).value).toBe(",/");
  });
});
