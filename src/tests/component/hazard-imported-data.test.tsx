// Hazard import HI-4: the hazard dialog's read-only "Imported data" block —
// source row, the customer's rating and the extra columns of the sheet.
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImportedDataSection } from "features/hazards/components/imported-data-section";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, o?: { defaultValue?: string }) => o?.defaultValue ?? key,
    i18n: { language: "en" },
  }),
}));

afterEach(cleanup);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const item = (over: Record<string, unknown>): any => ({ id: "HZ-1", label: "x", ...over });

describe("ImportedDataSection", () => {
  it("lists source row, rating and extra columns", () => {
    render(
      <ImportedDataSection
        item={item({
          externalRef: "2.2",
          importMeta: { rpn: "12", "severity.raw": "4", probability: "medium", "Hazard zone": "Applicator head" },
        })}
      />,
    );
    const block = screen.getByTestId("hazard-imported-data");
    const text = block.textContent ?? "";
    expect(text).toContain("2.2");
    expect(text).toContain("12");
    expect(text).toContain("Applicator head");
    expect(text).toContain("medium"); // level label (mocked t: its default)
    expect(text).toContain("Severity (source value)4");
  });

  it("ISO 12100 fields: lifecycle phases as chips, measure type by its label key", () => {
    render(
      <ImportedDataSection
        item={item({
          importMeta: { lifecyclePhase: "Transport, Cleaning", protectiveMeasureType: "technical", plRequired: "d" },
        })}
      />,
    );
    const block = screen.getByTestId("hazard-imported-data");
    expect(block.querySelectorAll(".MuiChip-root")).toHaveLength(2);
    expect(block.textContent).toContain("Lifecycle phase");
    expect(block.textContent).toContain("technical"); // mocked t: the default (raw value)
    expect(block.textContent).toContain("PL required");
  });

  it("renders nothing for a hazard that was not imported", () => {
    const { container } = render(<ImportedDataSection item={item({})} />);
    expect(container.firstChild).toBeNull();
  });
});
