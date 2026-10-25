// Hazard import HI-10: the re-import preview lists new / changed / removed /
// unchanged and returns the chosen mode; a flagged item shows a notice with
// "Reviewed".
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HazardReimportDialog } from "features/hazards/components/hazard-reimport-dialog";
import { ImportedDataSection } from "features/hazards/components/imported-data-section";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const h = (ref: string): any => ({ id: `HZ-${ref}`, externalRef: ref, label: `Hazard ${ref}` });

const plan = {
  profileId: "p",
  added: [h("9")],
  changed: [{ existing: h("2.2"), incoming: h("2.2") }],
  unchanged: [h("1"), h("3")],
  removed: [h("5")],
};

describe("HazardReimportDialog", () => {
  it("lists the groups with counts and returns the preselected mode", () => {
    const onConfirm = vi.fn();
    render(
      <HazardReimportDialog open plan={plan} fileName="la200.xlsx" profileName="LA-200" defaultMode="update" onConfirm={onConfirm} onCancel={() => {}} />,
    );
    expect(screen.getByTestId("reimport-added").textContent).toContain("(1)");
    expect(screen.getByTestId("reimport-changed").textContent).toContain("2.2 Hazard 2.2");
    expect(screen.getByTestId("reimport-removed").textContent).toContain("5 Hazard 5");
    expect(screen.getByTestId("reimport-unchanged").textContent).toContain("(2)");
    fireEvent.click(screen.getByTestId("reimport-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("update");
  });

  it("another file: additional is preselected and can be switched", () => {
    const onConfirm = vi.fn();
    render(
      <HazardReimportDialog open plan={plan} fileName="machine-b.xlsx" profileName="LA-200" defaultMode="additional" onConfirm={onConfirm} onCancel={() => {}} />,
    );
    expect((screen.getByRole("radio", { name: /additional hazards/ }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: /Update the hazards/ }));
    fireEvent.click(screen.getByTestId("reimport-confirm"));
    expect(onConfirm).toHaveBeenCalledWith("update");
  });
});

describe("ImportedDataSection — re-import flag", () => {
  it("shows the notice and Reviewed clears it", () => {
    const onReviewed = vi.fn();
    render(
      <ImportedDataSection
        item={{ ...h("2.2"), importMeta: { importStatus: "changed", importStatusSince: "2026-10-26T10:00:00Z", profileId: "p" } }}
        onReviewed={onReviewed}
      />,
    );
    expect(screen.getByTestId("hazard-import-status")).toBeTruthy();
    // bookkeeping keys are not listed as data
    expect(screen.getByTestId("hazard-imported-data").textContent).not.toContain("profileId");
    fireEvent.click(screen.getByRole("button", { name: "Reviewed" }));
    expect(onReviewed).toHaveBeenCalledTimes(1);
  });
});
